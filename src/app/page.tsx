import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Hospitality Agents</CardTitle>
          <CardDescription>
            AI agent dashboard for F&amp;B operators. Setup phase scaffold — Campaign Creator coming
            soon.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button disabled>Enter dashboard (auth wiring pending)</Button>
          <p className="text-muted-foreground text-sm">
            Next: wire Clerk auth, Supabase, and the generation pipeline in the Build phase.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
