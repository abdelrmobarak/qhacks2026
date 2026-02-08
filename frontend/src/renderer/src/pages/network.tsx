import { useState, useEffect, useCallback, useRef } from 'react'
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force'
import {
  EnvelopeSimple,
  ChatCircle,
  Globe,
  ShareNetwork,
  WarningCircle,
  ArrowClockwise,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty'
import {
  api,
  type NetworkGraphNode,
} from '../lib/api'

interface SimNode extends NetworkGraphNode {
  x: number
  y: number
  vx: number
  vy: number
  fx?: number | null
  fy?: number | null
}

interface SimLink {
  source: SimNode
  target: SimNode
  weight: number
}

interface ViewTransform {
  x: number
  y: number
  scale: number
}

const NODE_COLORS = [
  'oklch(0.7 0.15 250)',
  'oklch(0.7 0.15 290)',
  'oklch(0.7 0.15 330)',
  'oklch(0.7 0.15 20)',
  'oklch(0.7 0.15 50)',
  'oklch(0.7 0.15 130)',
  'oklch(0.7 0.15 170)',
  'oklch(0.7 0.15 210)',
]

const hashDomainToColor = (domain: string | undefined): string => {
  if (!domain) return 'oklch(0.6 0 0)'
  let hash = 0
  for (let charIndex = 0; charIndex < domain.length; charIndex++) {
    hash = domain.charCodeAt(charIndex) + ((hash << 5) - hash)
  }
  return NODE_COLORS[Math.abs(hash) % NODE_COLORS.length]
}

const getNodeRadius = (node: SimNode): number => {
  if (node.type === 'you') return 24
  return Math.max(8, Math.min(18, 6 + Math.sqrt(node.email_count) * 2.5))
}

const Network = () => {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalEmails, setTotalEmails] = useState(0)
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null)
  const [simulationNodes, setSimulationNodes] = useState<SimNode[]>([])
  const [simulationLinks, setSimulationLinks] = useState<SimLink[]>([])
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, scale: 1 })

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, transformX: 0, transformY: 0 })

  const loadGraph = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await api.getNetworkGraph()
      if (data.status === 'empty' || data.nodes.length === 0) {
        setSimulationNodes([])
        setSimulationLinks([])
        setTotalEmails(0)
        return
      }

      setTotalEmails(data.total_emails)

      const nodeMap = new Map<string, SimNode>()
      const initialNodes: SimNode[] = data.nodes.map((graphNode, nodeIndex) => {
        const angle = (2 * Math.PI * nodeIndex) / data.nodes.length
        const radius = graphNode.type === 'you' ? 0 : 200
        const simNode: SimNode = {
          ...graphNode,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
        }
        nodeMap.set(graphNode.id, simNode)
        return simNode
      })

      const initialLinks: SimLink[] = data.edges
        .filter(
          (graphEdge) => nodeMap.has(graphEdge.source) && nodeMap.has(graphEdge.target)
        )
        .map((graphEdge) => ({
          source: nodeMap.get(graphEdge.source)!,
          target: nodeMap.get(graphEdge.target)!,
          weight: graphEdge.weight,
        }))

      const simulation = forceSimulation<SimNode>(initialNodes)
        .force(
          'link',
          forceLink<SimNode, SimLink>(initialLinks)
            .id((forceNode) => forceNode.id)
            .distance(120)
            .strength(0.3)
        )
        .force('charge', forceManyBody<SimNode>().strength(-300))
        .force('center', forceCenter(0, 0))
        .force('collide', forceCollide<SimNode>().radius((forceNode) => getNodeRadius(forceNode) + 8))
        .stop()

      for (let tick = 0; tick < 300; tick++) {
        simulation.tick()
      }

      setSimulationNodes([...initialNodes])
      setSimulationLinks([...initialLinks])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load network')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGraph()
  }, [loadGraph])

  const handleWheel = useCallback((wheelEvent: WheelEvent) => {
    wheelEvent.preventDefault()
    const scaleFactor = wheelEvent.deltaY > 0 ? 0.92 : 1.08
    setTransform((previous) => {
      const newScale = Math.max(0.2, Math.min(4, previous.scale * scaleFactor))
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return { ...previous, scale: newScale }

      const mouseX = wheelEvent.clientX - rect.left
      const mouseY = wheelEvent.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const scaleRatio = newScale / previous.scale

      return {
        x: mouseX - centerX - (mouseX - previous.x - centerX) * scaleRatio,
        y: mouseY - centerY - (mouseY - previous.y - centerY) * scaleRatio,
        scale: newScale,
      }
    })
  }, [])

  useEffect(() => {
    const svgElement = svgRef.current
    if (!svgElement) return
    svgElement.addEventListener('wheel', handleWheel, { passive: false })
    return () => svgElement.removeEventListener('wheel', handleWheel)
  }, [handleWheel, simulationNodes])

  const handleBackgroundMouseDown = useCallback(
    (mouseEvent: React.MouseEvent) => {
      if (mouseEvent.button !== 0) return
      isPanningRef.current = true
      panStartRef.current = {
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        transformX: transform.x,
        transformY: transform.y,
      }
    },
    [transform.x, transform.y]
  )

  const handleMouseMove = useCallback((moveEvent: React.MouseEvent) => {
    if (!isPanningRef.current) return
    const deltaX = moveEvent.clientX - panStartRef.current.x
    const deltaY = moveEvent.clientY - panStartRef.current.y
    setTransform((previous) => ({
      ...previous,
      x: panStartRef.current.transformX + deltaX,
      y: panStartRef.current.transformY + deltaY,
    }))
  }, [])

  const handleMouseUp = useCallback(() => {
    isPanningRef.current = false
  }, [])

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const scaleFactor = direction === 'in' ? 1.25 : 0.8
    setTransform((previous) => ({
      ...previous,
      scale: Math.max(0.2, Math.min(4, previous.scale * scaleFactor)),
    }))
  }, [])

  const handleNodeClick = useCallback(
    (clickEvent: React.MouseEvent, clickedNode: SimNode) => {
      clickEvent.stopPropagation()
      setSelectedNode((currentSelection) =>
        currentSelection?.id === clickedNode.id ? null : clickedNode
      )
    },
    []
  )

  const maxEdgeWeight = simulationLinks.length > 0
    ? Math.max(...simulationLinks.map((simLink) => simLink.weight))
    : 1

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (error) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <WarningCircle />
          </EmptyMedia>
          <EmptyTitle>Failed to load network</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  if (simulationNodes.length === 0) {
    return (
      <Empty className="py-16">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShareNetwork />
          </EmptyMedia>
          <EmptyTitle>No network data</EmptyTitle>
          <EmptyDescription>
            No emails found. Make sure your Google account is connected.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" size="sm" onClick={loadGraph} className="gap-1.5">
          <ArrowClockwise className="size-3" />
          Retry
        </Button>
      </Empty>
    )
  }

  const containerWidth = containerRef.current?.clientWidth ?? 800
  const containerHeight = containerRef.current?.clientHeight ?? 600
  const centerOffsetX = containerWidth / 2
  const centerOffsetY = containerHeight / 2

  return (
    <div className="absolute inset-0 overflow-hidden" ref={containerRef}>
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleBackgroundMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <pattern
            id="grid-small"
            width={20 * transform.scale}
            height={20 * transform.scale}
            patternUnits="userSpaceOnUse"
            x={transform.x + centerOffsetX}
            y={transform.y + centerOffsetY}
          >
            <path
              d={`M ${20 * transform.scale} 0 L 0 0 0 ${20 * transform.scale}`}
              fill="none"
              stroke="oklch(0.55 0 0 / 0.15)"
              strokeWidth={0.5}
            />
          </pattern>
          <pattern
            id="grid-large"
            width={100 * transform.scale}
            height={100 * transform.scale}
            patternUnits="userSpaceOnUse"
            x={transform.x + centerOffsetX}
            y={transform.y + centerOffsetY}
          >
            <rect
              width={100 * transform.scale}
              height={100 * transform.scale}
              fill="url(#grid-small)"
            />
            <path
              d={`M ${100 * transform.scale} 0 L 0 0 0 ${100 * transform.scale}`}
              fill="none"
              stroke="oklch(0.55 0 0 / 0.25)"
              strokeWidth={0.5}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-large)" />
        <g
          transform={`translate(${transform.x + centerOffsetX}, ${transform.y + centerOffsetY}) scale(${transform.scale})`}
        >
          {simulationLinks.map((simLink, linkIndex) => {
            const normalizedWeight = simLink.weight / maxEdgeWeight
            const isSelectedEdge =
              selectedNode &&
              (simLink.source.id === selectedNode.id ||
                simLink.target.id === selectedNode.id)

            return (
              <line
                key={linkIndex}
                x1={simLink.source.x}
                y1={simLink.source.y}
                x2={simLink.target.x}
                y2={simLink.target.y}
                stroke={isSelectedEdge ? 'oklch(0.6 0.18 262)' : 'oklch(0.55 0 0)'}
                strokeWidth={Math.max(0.5, normalizedWeight * 3)}
                strokeOpacity={
                  selectedNode
                    ? isSelectedEdge
                      ? 0.8
                      : 0.1
                    : 0.2 + normalizedWeight * 0.4
                }
              />
            )
          })}

          {simulationNodes.map((simNode) => {
            const nodeRadius = getNodeRadius(simNode)
            const isYouNode = simNode.type === 'you'
            const isSelected = selectedNode?.id === simNode.id
            const isConnectedToSelected =
              selectedNode &&
              simulationLinks.some(
                (simLink) =>
                  (simLink.source.id === selectedNode.id && simLink.target.id === simNode.id) ||
                  (simLink.target.id === selectedNode.id && simLink.source.id === simNode.id)
              )
            const shouldDim = selectedNode && !isSelected && !isConnectedToSelected

            const fillColor = isYouNode
              ? 'oklch(0.6 0.18 262)'
              : hashDomainToColor(simNode.domain)

            return (
              <g
                key={simNode.id}
                className="cursor-pointer"
                onClick={(clickEvent) => handleNodeClick(clickEvent, simNode)}
                opacity={shouldDim ? 0.15 : 1}
              >
                {isSelected && (
                  <circle
                    cx={simNode.x}
                    cy={simNode.y}
                    r={nodeRadius + 4}
                    fill="none"
                    stroke="oklch(0.40 0.17 262)"
                    strokeWidth={2}
                  />
                )}

                <circle
                  cx={simNode.x}
                  cy={simNode.y}
                  r={nodeRadius}
                  fill={fillColor}
                  fillOpacity={isYouNode ? 1 : 0.85}
                />

                {isYouNode && (
                  <text
                    x={simNode.x}
                    y={simNode.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="white"
                    fontSize={11}
                    fontWeight={600}
                  >
                    You
                  </text>
                )}

                <text
                  x={simNode.x}
                  y={simNode.y + nodeRadius + 12}
                  textAnchor="middle"
                  fill="oklch(0.55 0 0)"
                  fontSize={10}
                  fontWeight={isYouNode ? 600 : 400}
                >
                  {isYouNode ? '' : simNode.name}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2">
        <Badge variant="default" className="pointer-events-auto">
          {simulationNodes.length - 1} contacts
        </Badge>
        <Badge variant="default" className="pointer-events-auto">
          {simulationLinks.filter(
            (simLink) => simLink.source.id !== 'you' && simLink.target.id !== 'you'
          ).length}{' '}
          connections
        </Badge>
        <Badge variant="default" className="pointer-events-auto">
          {totalEmails} emails
        </Badge>
        <Button
          variant="ghost"
          size="icon-sm"
          className="pointer-events-auto"
          onClick={loadGraph}
          disabled={isLoading}
        >
          <ArrowClockwise className={isLoading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => handleZoom('in')}
        >
          <MagnifyingGlassPlusIcon className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => handleZoom('out')}
        >
          <MagnifyingGlassMinusIcon className="size-4" />
        </Button>
      </div>

      <Sheet
        open={!!selectedNode && selectedNode.type !== 'you'}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedNode(null)
        }}
      >
        <SheetContent
          side="right"
          overlayClassName="top-10"
          className="data-[side=right]:top-10 flex flex-col gap-4 sm:max-w-xs"
        >
          {selectedNode && selectedNode.type !== 'you' && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedNode.name}</SheetTitle>
                <span className="text-xs text-muted-foreground">{selectedNode.email}</span>
              </SheetHeader>

              <div className="flex flex-col gap-4 px-4 pb-4">
                {selectedNode.description && (
                  <span className="text-xs text-muted-foreground">
                    {selectedNode.description}
                  </span>
                )}

                {selectedNode.domain && (
                  <Badge variant="outline" className="w-fit">
                    <Globe className="size-3" data-icon="inline-start" />
                    {selectedNode.domain}
                  </Badge>
                )}

                <Separator />

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-0.5 rounded-md border p-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <EnvelopeSimple className="size-3" />
                      <span className="text-xs">Emails</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {selectedNode.email_count}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 rounded-md border p-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <ChatCircle className="size-3" />
                      <span className="text-xs">Threads</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {selectedNode.thread_count}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium">Connections</span>
                  <div className="flex flex-wrap gap-1.5">
                    {simulationLinks
                      .filter(
                        (simLink) =>
                          simLink.source.id === selectedNode.id ||
                          simLink.target.id === selectedNode.id
                      )
                      .filter(
                        (simLink) =>
                          simLink.source.id !== 'you' && simLink.target.id !== 'you'
                      )
                      .sort((linkA, linkB) => linkB.weight - linkA.weight)
                      .slice(0, 8)
                      .map((simLink) => {
                        const connectedNode =
                          simLink.source.id === selectedNode.id
                            ? simLink.target
                            : simLink.source
                        return (
                          <Badge key={connectedNode.id} variant="outline">
                            {connectedNode.name}
                            <span className="text-muted-foreground tabular-nums">
                              {simLink.weight}
                            </span>
                          </Badge>
                        )
                      })}
                    {simulationLinks.filter(
                      (simLink) =>
                        (simLink.source.id === selectedNode.id ||
                          simLink.target.id === selectedNode.id) &&
                        simLink.source.id !== 'you' &&
                        simLink.target.id !== 'you'
                    ).length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No shared threads with other contacts
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default Network
