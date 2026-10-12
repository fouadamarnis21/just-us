
export function isAllowedUser(userId: string): boolean {
  const allowedIds = (
    process.env.JUST_US_ALLOWED_USER_IDS || ""
  )
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  return allowedIds.includes(userId);
}
