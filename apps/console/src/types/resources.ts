export type ResourceKind = 'skills' | 'commands' | 'agents' | 'rules'

export interface ResourceEntry {
  name: string
  enabled: boolean
  source?: string
  path?: string
  description?: string
}
