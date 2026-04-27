export const DEV_USER_ID = '11111111-1111-1111-1111-111111111111'

export async function getCurrentUserId(): Promise<string> {
  return DEV_USER_ID
}
