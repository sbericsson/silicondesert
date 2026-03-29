import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        const commissioner = await prisma.commissioner.findUnique({
          where: { username: credentials.username }
        })

        if (!commissioner) {
          return null
        }

        const valid = await compare(credentials.password, commissioner.passwordHash)
        if (!valid) {
          return null
        }

        return {
          id: commissioner.id,
          name: commissioner.username
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60
  },
  pages: {
    signIn: '/login'
  }
}
