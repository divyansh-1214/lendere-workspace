'use server'
import { cookies } from 'next/headers'
 
export default async function setId(name:string,id:string) {
  const cookieStore = await cookies()
  cookieStore.set(name, id)
}

export async function getId(name:string) {
  const cookieStore = await cookies()
  return cookieStore.get(name)?.value
}