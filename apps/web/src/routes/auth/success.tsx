import { createFileRoute } from '@tanstack/react-router'
import AuthSuccessPage from '../../pages/AuthSuccessPage'

export const Route = createFileRoute('/auth/success')({
  component: AuthSuccessPage,
})

