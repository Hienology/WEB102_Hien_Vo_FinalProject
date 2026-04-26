-- Grand Slam Hub: SQL-first tagging + edit-time setup
-- Run this in Supabase SQL Editor.

-- 1) Ensure posts.tags exists, stores multiple tags, and is never NULL.
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

UPDATE public.posts
SET tags = '{}'::text[]
WHERE tags IS NULL;

ALTER TABLE public.posts
ALTER COLUMN tags SET DEFAULT '{}'::text[],
ALTER COLUMN tags SET NOT NULL;

-- 2) Track latest post edit time.
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Update edited_at only when editable post content fields actually change.
CREATE OR REPLACE FUNCTION public.set_post_edited_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.title IS DISTINCT FROM OLD.title
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.image_url IS DISTINCT FROM OLD.image_url
    OR NEW.tags IS DISTINCT FROM OLD.tags
  ) THEN
    NEW.edited_at = NOW();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_post_edited_at ON public.posts;

CREATE TRIGGER trg_set_post_edited_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.set_post_edited_at();

-- 3) Speed up tag search for array queries.
CREATE INDEX IF NOT EXISTS posts_tags_gin_idx
ON public.posts
USING GIN (tags);

-- 4) SQL search function across title/content/tags with sort support.
DROP FUNCTION IF EXISTS public.search_posts(text, text);
DROP FUNCTION IF EXISTS public.search_posts(text, text[], text);

CREATE OR REPLACE FUNCTION public.search_posts(
  p_query text DEFAULT '',
  p_tags text[] DEFAULT '{}'::text[],
  p_sort text DEFAULT 'newest'
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
AS $$
  WITH criteria AS (
    SELECT
      LOWER(BTRIM(COALESCE(p_query, ''))) AS query,
      COALESCE(
        ARRAY(
          SELECT DISTINCT LOWER(BTRIM(REPLACE(tag, '#', '')))
          FROM UNNEST(COALESCE(p_tags, '{}'::text[])) AS tag
          WHERE BTRIM(tag) <> ''
        ),
        '{}'::text[]
      ) AS tags
  )
  SELECT p.*
  FROM public.posts AS p
  CROSS JOIN criteria AS c
  WHERE
    (
      c.query = ''
      OR LOWER(p.title) LIKE '%' || c.query || '%'
      OR LOWER(COALESCE(p.content, '')) LIKE '%' || c.query || '%'
    )
    AND (
      COALESCE(array_length(c.tags, 1), 0) = 0
      OR EXISTS (
        SELECT 1
        FROM UNNEST(p.tags) AS tag
        WHERE LOWER(tag) = ANY(c.tags)
      )
    )
  ORDER BY
    CASE WHEN p_sort = 'popular' THEN p.upvotes END DESC,
    p.created_at DESC;
$$;

-- 5) Allow app roles to call the function via Supabase RPC.
GRANT EXECUTE ON FUNCTION public.search_posts(text, text[], text) TO anon, authenticated;
