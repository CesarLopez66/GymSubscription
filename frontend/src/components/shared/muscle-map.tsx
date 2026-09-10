"use client"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Matches the free-text `muscle_group` values used across the exercise
// catalog (backend/app/scripts/seed_data.py) — anything outside this set
// (a gym's own custom category) simply has no region to click, which is an
// acceptable gap: the diagram covers the common case, not every possible
// custom label a gym could type in.
export const MUSCLE_LABELS: Record<string, string> = {
  Chest: "Pecho",
  Back: "Espalda",
  Shoulders: "Hombros",
  Arms: "Brazos",
  Core: "Core",
  Legs: "Piernas",
  Cardio: "Cardio",
}

const FRONT_GROUPS = ["Shoulders", "Chest", "Arms", "Core", "Legs"]
const BACK_GROUPS = ["Shoulders", "Back", "Arms", "Legs"]

// One distinct, saturated color per clickable region — mirrors the look of
// a printed anatomical muscle chart instead of a flat single-tone body.
const REGION_COLORS: Record<string, string> = {
  Shoulders: "#f59e0b",
  Chest: "#f43f5e",
  Core: "#84cc16",
  Arms: "#22c55e",
  Back: "#14b8a6",
  Legs: "#3b82f6",
}

const SKIN = "#e3c19c"
const skinFill = { fill: SKIN }

function regionProps(group: string, selected: string | null, faint = false) {
  const isSelected = selected === group
  const isDimmed = selected !== null && !isSelected
  return {
    className: cn(
      "cursor-pointer stroke-black/30 stroke-1 transition-all duration-200",
      !isDimmed && "hover:brightness-110",
      isDimmed && "opacity-25 saturate-0"
    ),
    style: {
      fill: REGION_COLORS[group],
      fillOpacity: faint ? 0.82 : 1,
      filter: isSelected ? `drop-shadow(0 0 10px ${REGION_COLORS[group]})` : undefined,
    },
  }
}

// Thin non-interactive strokes that add anatomical definition (six-pack
// lines, lat wings, knee/elbow creases) on top of the clickable regions.
const detailLine = "pointer-events-none fill-none stroke-black/30"

function BodySvg({
  view,
  selected,
  onSelect,
}: {
  view: "front" | "back"
  selected: string | null
  onSelect: (group: string) => void
}) {
  const click = (group: string) => () => onSelect(group)

  return (
    <svg viewBox="0 0 200 380" className="h-full w-full">
      {/* head, neck, torso silhouette — decorative skin base */}
      <circle cx="100" cy="22" r="16" style={skinFill} className="pointer-events-none" />
      <rect x="91" y="36" width="18" height="14" rx="4" style={skinFill} className="pointer-events-none" />
      <path
        d="M60,48 L140,48 L130,184 L70,184 Z"
        style={skinFill}
        className="pointer-events-none"
      />

      {/* arm + leg skin base (mirrored) */}
      <g className="pointer-events-none">
        <rect x="32" y="50" width="26" height="132" rx="13" style={skinFill} />
        <ellipse cx="45" cy="188" rx="12" ry="16" style={skinFill} />
        <rect x="66" y="186" width="30" height="150" rx="15" style={skinFill} />
        <ellipse cx="80" cy="344" rx="17" ry="10" style={skinFill} />
      </g>
      <g className="pointer-events-none" transform="translate(200,0) scale(-1,1)">
        <rect x="32" y="50" width="26" height="132" rx="13" style={skinFill} />
        <ellipse cx="45" cy="188" rx="12" ry="16" style={skinFill} />
        <rect x="66" y="186" width="30" height="150" rx="15" style={skinFill} />
        <ellipse cx="80" cy="344" rx="17" ry="10" style={skinFill} />
      </g>

      {/* shoulders / deltoids (mirrored) */}
      <ellipse cx="56" cy="60" rx="16" ry="14" onClick={click("Shoulders")} {...regionProps("Shoulders", selected)}>
        <title>{MUSCLE_LABELS.Shoulders}</title>
      </ellipse>
      <ellipse cx="144" cy="60" rx="16" ry="14" onClick={click("Shoulders")} {...regionProps("Shoulders", selected)} />

      {view === "front" ? (
        <>
          {/* pectorals */}
          <rect x="70" y="52" width="60" height="46" rx="16" onClick={click("Chest")} {...regionProps("Chest", selected)}>
            <title>{MUSCLE_LABELS.Chest}</title>
          </rect>
          <line x1="100" y1="54" x2="100" y2="96" className={detailLine} strokeWidth={1.5} />
          <path d="M74,90 Q100,102 126,90" className={detailLine} strokeWidth={1.2} />

          {/* abdominals */}
          <rect x="82" y="102" width="36" height="66" rx="12" onClick={click("Core")} {...regionProps("Core", selected)}>
            <title>{MUSCLE_LABELS.Core}</title>
          </rect>
          <line x1="100" y1="102" x2="100" y2="168" className={detailLine} strokeWidth={1.2} />
          <line x1="84" y1="120" x2="116" y2="120" className={detailLine} strokeWidth={1} />
          <line x1="84" y1="138" x2="116" y2="138" className={detailLine} strokeWidth={1} />
          <line x1="84" y1="156" x2="116" y2="156" className={detailLine} strokeWidth={1} />

          {/* obliques */}
          <rect x="72" y="104" width="10" height="60" rx="5" onClick={click("Core")} {...regionProps("Core", selected, true)} />
          <rect x="118" y="104" width="10" height="60" rx="5" onClick={click("Core")} {...regionProps("Core", selected, true)} />
        </>
      ) : (
        <>
          {/* trapezius */}
          <path
            d="M78,50 L122,50 L134,84 L100,98 L66,84 Z"
            onClick={click("Back")}
            {...regionProps("Back", selected)}
          >
            <title>{MUSCLE_LABELS.Back}</title>
          </path>
          {/* lats + lower back */}
          <path
            d="M70,86 C60,112 60,150 70,180 C80,188 120,188 130,180 C140,150 140,112 130,86 L100,100 Z"
            onClick={click("Back")}
            {...regionProps("Back", selected, true)}
          />
          <line x1="100" y1="52" x2="100" y2="184" className={detailLine} strokeWidth={1.2} />
          <path d="M72,96 Q90,138 96,182" className={detailLine} strokeWidth={1} />
          <path d="M128,96 Q110,138 104,182" className={detailLine} strokeWidth={1} />

          {/* glutes */}
          <rect x="74" y="182" width="52" height="26" rx="13" onClick={click("Legs")} {...regionProps("Legs", selected)} />
        </>
      )}

      {/* arms: bicep/triceps + forearm (mirrored) — same color, both views */}
      <rect x="36" y="55" width="18" height="48" rx="9" onClick={click("Arms")} {...regionProps("Arms", selected)}>
        <title>{MUSCLE_LABELS.Arms}</title>
      </rect>
      <rect x="36" y="107" width="18" height="68" rx="9" onClick={click("Arms")} {...regionProps("Arms", selected, true)} />
      <rect x="146" y="55" width="18" height="48" rx="9" onClick={click("Arms")} {...regionProps("Arms", selected)} />
      <rect x="146" y="107" width="18" height="68" rx="9" onClick={click("Arms")} {...regionProps("Arms", selected, true)} />
      <line x1="34" y1="104" x2="56" y2="104" className={detailLine} strokeWidth={1} />
      <line x1="144" y1="104" x2="166" y2="104" className={detailLine} strokeWidth={1} />

      {/* legs: quad/hamstring + calf (mirrored) */}
      <rect x="69" y="190" width="24" height="72" rx="12" onClick={click("Legs")} {...regionProps("Legs", selected)}>
        <title>{MUSCLE_LABELS.Legs}</title>
      </rect>
      <rect x="69" y="266" width="24" height="64" rx="12" onClick={click("Legs")} {...regionProps("Legs", selected, true)} />
      <rect x="107" y="190" width="24" height="72" rx="12" onClick={click("Legs")} {...regionProps("Legs", selected)} />
      <rect x="107" y="266" width="24" height="64" rx="12" onClick={click("Legs")} {...regionProps("Legs", selected, true)} />
      <line x1="66" y1="264" x2="94" y2="264" className={detailLine} strokeWidth={1.2} />
      <line x1="106" y1="264" x2="134" y2="264" className={detailLine} strokeWidth={1.2} />
    </svg>
  )
}

export function MuscleMap({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (group: string | null) => void
}) {
  const allGroups = [...new Set([...FRONT_GROUPS, ...BACK_GROUPS, "Cardio"])]

  const handleSelect = (group: string) => {
    onSelect(selected === group ? null : group)
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-start justify-center gap-8 sm:gap-16">
        <div className="flex flex-col items-center gap-2">
          <div className="h-104 w-56">
            <BodySvg view="front" selected={selected} onSelect={handleSelect} />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Frente</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-104 w-56">
            <BodySvg view="back" selected={selected} onSelect={handleSelect} />
          </div>
          <p className="text-xs font-medium text-muted-foreground">Espalda</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {allGroups.map((group) => (
          <Button
            key={group}
            type="button"
            size="sm"
            variant={selected === group ? "default" : "outline"}
            onClick={() => handleSelect(group)}
          >
            {MUSCLE_LABELS[group]}
          </Button>
        ))}
        {selected && (
          <Button type="button" size="sm" variant="ghost" onClick={() => onSelect(null)}>
            Limpiar
          </Button>
        )}
      </div>
    </div>
  )
}
