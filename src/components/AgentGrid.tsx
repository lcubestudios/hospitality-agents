'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Sparkles, MessageSquare, Calendar, UtensilsCrossed, Users, TrendingUp } from 'lucide-react'

const AGENTS = [
  {
    id: 'campaign-creator',
    name: 'Campaign Creator',
    description: 'Generate enhanced images, videos, and captions for your products',
    status: 'available' as const,
    icon: Sparkles,
  },
  {
    id: 'review-response',
    name: 'Review Response',
    description: 'AI-powered responses to customer reviews',
    status: 'coming-soon' as const,
    icon: MessageSquare,
  },
  {
    id: 'reservation-assist',
    name: 'Reservation Assist',
    description: 'Intelligent reservation management and optimization',
    status: 'coming-soon' as const,
    icon: Calendar,
  },
  {
    id: 'menu-sync',
    name: 'Menu Sync',
    description: 'Synchronize and optimize your menu across platforms',
    status: 'coming-soon' as const,
    icon: UtensilsCrossed,
  },
  {
    id: 'staff-comms',
    name: 'Staff Comms',
    description: 'Streamlined team communication and shift management',
    status: 'coming-soon' as const,
    icon: Users,
  },
  {
    id: 'promo-planner',
    name: 'Promo Planner',
    description: 'Plan and execute promotional campaigns',
    status: 'coming-soon' as const,
    icon: TrendingUp,
  },
]

export function AgentGrid({ onSelectAgent }: { onSelectAgent: (agentId: string) => void }) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Agents</h1>
      <p className="mb-8 text-sm text-gray-500">
        Each agent automates a different part of running your venue. Start with Campaign Creator to
        generate photos, videos, and captions tailored to your brand.
      </p>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((agent) => {
          const Icon = agent.icon
          return (
            <Card
              key={agent.id}
              className="flex flex-col justify-between overflow-hidden transition-shadow hover:shadow-lg"
            >
              <div className="flex gap-4 p-6">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
                  <Icon className="h-6 w-6 text-gray-700" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-gray-800">{agent.name}</h2>
                  <p className="text-sm text-gray-600">{agent.description}</p>
                </div>
              </div>

              <div className="border-t bg-gray-50 px-6 py-4">
                {agent.status === 'available' ? (
                  <Button
                    onClick={() => onSelectAgent(agent.id)}
                    className="w-full"
                    variant="default"
                  >
                    Open
                  </Button>
                ) : (
                  <div className="flex items-center justify-center">
                    <span className="inline-block rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-600">
                      Coming Soon
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
