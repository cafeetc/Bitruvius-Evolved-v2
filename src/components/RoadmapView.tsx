import React, { useMemo, useState } from 'react';
import { Check, CheckCircle2, CircleAlert, Compass, Copy, FileText, Sparkles } from 'lucide-react';
import {
  ROADMAP_ENTRIES,
  ROADMAP_METADATA,
  RoadmapEntry,
  RoadmapStatus,
} from '../data/roadmap';

type RoadmapFilter = 'all' | RoadmapStatus;

const STATUS_META: Record<
  RoadmapStatus,
  {
    label: string;
    badgeClass: string;
    Icon: React.FC<{ className?: string }>;
  }
> = {
  awaiting_rules: {
    label: 'INTAKE READY',
    badgeClass: 'bg-[#451A03]/60 text-[#FDE68A] border-[#FBBF24]/40',
    Icon: FileText,
  },
  unresolved: {
    label: 'UNRESOLVED',
    badgeClass: 'bg-[#450A0A]/55 text-[#FCA5A5] border-[#F87171]/35',
    Icon: CircleAlert,
  },
  vision: {
    label: 'FUTURE VISION',
    badgeClass: 'bg-[#2E1065]/60 text-[#E9D5FF] border-[#C084FC]/35',
    Icon: Sparkles,
  },
  completed: {
    label: 'COMPLETED',
    badgeClass: 'bg-[#052E16]/60 text-[#86EFAC] border-[#4ADE80]/30',
    Icon: CheckCircle2,
  },
};

const SECTION_ORDER: {
  status: RoadmapStatus;
  heading: string;
  subtitle: string;
}[] = [
  {
    status: 'awaiting_rules',
    heading: 'I. Initial Blueprint Rules Intake',
    subtitle: 'Ready to ingest your canonical ruleset, reconcile conflicts, and lock constraints.',
  },
  {
    status: 'unresolved',
    heading: 'II. Currently Unresolved',
    subtitle: 'Open calibration, alignment, and audit tasks tracked against the current baseline.',
  },
  {
    status: 'vision',
    heading: 'III. Future Visions',
    subtitle: 'Planned Puppyt-to-Evolved mechanics and multi-phase studio capabilities.',
  },
  {
    status: 'completed',
    heading: 'IV. Completed & Integrated Baseline',
    subtitle: 'Capabilities verified and active in the running Bitruvius Evolved build.',
  },
];

function formatEntriesAsMarkdown(entries: readonly RoadmapEntry[]): string {
  const lines: string[] = [
    `# Bitruvius Evolved — Architecture & Evolution Roadmap (${ROADMAP_METADATA.version})`,
    `Updated: ${ROADMAP_METADATA.lastUpdated}`,
    `Silhouette Ink: ${ROADMAP_METADATA.silhouetteColorHex} | Proportions: ${ROADMAP_METADATA.activeScaleLabel}`,
    '',
  ];

  for (const sec of SECTION_ORDER) {
    const group = entries.filter((e) => e.status === sec.status);
    if (group.length === 0) continue;
    lines.push(`## ${sec.heading}`);
    for (const item of group) {
      lines.push(`- **${item.title}** — ${item.summary}`);
      for (const detail of item.details) {
        lines.push(`  - ${detail}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const RoadmapView: React.FC = () => {
  const [filter, setFilter] = useState<RoadmapFilter>('all');
  const [copied, setCopied] = useState(false);

  const counts = useMemo(() => {
    return {
      all: ROADMAP_ENTRIES.length,
      awaiting_rules: ROADMAP_ENTRIES.filter((e) => e.status === 'awaiting_rules').length,
      unresolved: ROADMAP_ENTRIES.filter((e) => e.status === 'unresolved').length,
      vision: ROADMAP_ENTRIES.filter((e) => e.status === 'vision').length,
      completed: ROADMAP_ENTRIES.filter((e) => e.status === 'completed').length,
    };
  }, []);

  const visibleSections = useMemo(() => {
    return SECTION_ORDER.map((section) => ({
      ...section,
      items: ROADMAP_ENTRIES.filter(
        (entry) =>
          entry.status === section.status && (filter === 'all' || entry.status === filter)
      ),
    })).filter((s) => s.items.length > 0);
  }, [filter]);

  const handleCopyMarkdown = async () => {
    try {
      const md = formatEntriesAsMarkdown(ROADMAP_ENTRIES);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  return (
    <div
      data-roadmap-view="true"
      className="flex-1 min-h-0 overflow-y-auto console-scroll bg-[#110118] text-[#EFE7F6]"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Document Header */}
        <section className="bg-[#1A0524] border border-[#EBE0F5]/16 rounded-[3px] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-vera text-[#C8B2E0] uppercase tracking-[0.08em]">
                <Compass className="w-3.5 h-3.5 text-[#D8B4FE]" />
                <span>ROADMAP.md</span>
                <span className="text-[#EBE0F5]/30">/</span>
                <span>{ROADMAP_METADATA.version}</span>
                <span className="text-[#EBE0F5]/30">/</span>
                <span>Updated {ROADMAP_METADATA.lastUpdated}</span>
              </div>
              <h1 className="font-typewriter font-bold text-xl sm:text-2xl text-[#FAF6FF] tracking-[0.02em]">
                Bitruvius Evolved Roadmap & Blueprint Ledger
              </h1>
              <p className="text-xs font-vera text-[#B8A9C9] leading-relaxed max-w-3xl">
                Living architecture document synchronizing active Bitruvius-Evolved stage behavior,
                Bitruvian.Human.Puppyt skeleton integration, currently unresolved items, and upcoming
                future visions.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 text-[11px] font-vera font-bold bg-[#260B32] hover:bg-[#361547] text-[#FAF6FF] border border-[#EBE0F5]/20 rounded-[3px] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#86EFAC]" />
                  Copied Markdown
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#D8B4FE]" />
                  Copy Markdown
                </>
              )}
            </button>
          </div>

          {/* Active System Telemetry / Specs Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2 border-t border-[#EBE0F5]/10">
            <div className="bg-[#0D0012]/70 border border-[#EBE0F5]/12 rounded-[3px] px-3 py-2 flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="w-4 h-4 rounded-[2px] border border-[#EBE0F5]/35 shrink-0"
                style={{ backgroundColor: ROADMAP_METADATA.silhouetteColorHex }}
              />
              <div className="min-w-0">
                <div className="text-[10px] font-vera uppercase tracking-[0.06em] text-[#9E8EB3]">
                  Default Silhouette Ink
                </div>
                <div className="text-[11px] font-typewriter font-bold text-[#FAF6FF] truncate">
                  {ROADMAP_METADATA.silhouetteColorHex} · Dark Purple-Gray
                </div>
              </div>
            </div>

            <div className="bg-[#0D0012]/70 border border-[#EBE0F5]/12 rounded-[3px] px-3 py-2">
              <div className="text-[10px] font-vera uppercase tracking-[0.06em] text-[#9E8EB3]">
                Active Rig Proportions
              </div>
              <div className="text-[11px] font-typewriter font-bold text-[#FAF6FF] truncate">
                {ROADMAP_METADATA.activeScaleLabel}
              </div>
            </div>

            <div className="bg-[#0D0012]/70 border border-[#EBE0F5]/12 rounded-[3px] px-3 py-2">
              <div className="text-[10px] font-vera uppercase tracking-[0.06em] text-[#9E8EB3]">
                Hidden Spec Archive
              </div>
              <div className="text-[11px] font-typewriter font-bold text-[#C8B2E0] truncate">
                {ROADMAP_METADATA.hiddenScaleLabel}
              </div>
            </div>
          </div>

          {/* Filter Strip */}
          <div
            role="tablist"
            aria-label="Filter roadmap items"
            className="flex flex-wrap items-center gap-1.5 pt-1"
          >
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'awaiting_rules', label: `Blueprint Intake (${counts.awaiting_rules})` },
                { id: 'unresolved', label: `Unresolved (${counts.unresolved})` },
                { id: 'vision', label: `Future Visions (${counts.vision})` },
                { id: 'completed', label: `Completed (${counts.completed})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-2.5 py-1 text-[10.5px] font-vera font-bold rounded-[3px] border transition-colors cursor-pointer ${
                  filter === tab.id
                    ? 'bg-[#361547] text-[#FAF6FF] border-[#D8B4FE]/45'
                    : 'bg-[#0D0012]/65 text-[#B8A9C9] hover:text-[#FAF6FF] border-[#EBE0F5]/14'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* Sections */}
        {visibleSections.map((section) => (
          <section key={section.status} className="space-y-3">
            <div className="border-b border-[#EBE0F5]/14 pb-2">
              <h2 className="font-typewriter font-bold text-base text-[#FAF6FF] tracking-[0.03em]">
                {section.heading}
              </h2>
              <p className="text-[11px] font-vera text-[#9E8EB3] mt-0.5">{section.subtitle}</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {section.items.map((item) => {
                const statusMeta = STATUS_META[item.status];
                const StatusIcon = statusMeta.Icon;

                return (
                  <article
                    key={item.id}
                    className="bg-[#180421] border border-[#EBE0F5]/14 rounded-[3px] p-4 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9.5px] font-vera font-bold uppercase tracking-[0.05em] border rounded-[2px] ${statusMeta.badgeClass}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusMeta.label}
                          </span>
                          <span className="px-1.5 py-0.5 text-[9.5px] font-vera uppercase tracking-[0.05em] bg-[#0D0012]/70 text-[#C8B2E0] border border-[#EBE0F5]/12 rounded-[2px]">
                            {item.category}
                          </span>
                          {item.priority && (
                            <span className="px-1.5 py-0.5 text-[9.5px] font-vera uppercase tracking-[0.05em] bg-[#21072B] text-[#E9D5FF] border border-[#EBE0F5]/14 rounded-[2px]">
                              Priority: {item.priority}
                            </span>
                          )}
                        </div>
                        <h3 className="font-typewriter font-bold text-sm text-[#FAF6FF]">
                          {item.title}
                        </h3>
                      </div>

                      {item.codeRefs && item.codeRefs.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.codeRefs.map((ref) => (
                            <code
                              key={ref}
                              className="px-1.5 py-0.5 text-[9.5px] font-typewriter bg-[#0D0012] text-[#B8A9C9] border border-[#EBE0F5]/12 rounded-[2px]"
                            >
                              {ref}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-xs font-vera text-[#D8CEE4] leading-relaxed">
                      {item.summary}
                    </p>

                    <ul className="space-y-1 pl-4 list-disc marker:text-[#C084FC]/65 text-[11px] font-vera text-[#B8A9C9]">
                      {item.details.map((detail, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
