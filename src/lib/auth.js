/**
 * Returns the stored user UUID from localStorage,
 * creating and storing a new one if it doesn't exist.
 */
export function getUserId() {
  let userId = localStorage.getItem('grand_slam_user_id')
  if (!userId) {
    userId = crypto.randomUUID()
    localStorage.setItem('grand_slam_user_id', userId)
  }
  return userId
}
