'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SECTION_KEYS } from '@/lib/types';
import type {
  DeskAttestation,
  DeskContext,
  DeskMeta,
  DeskPost,
  DeskPostUpdate,
  DeskSections,
} from '@/lib/types';
import { DraftEditor } from './DraftEditor';
import { LinterRail } from './LinterRail';
import { AttestationModal } from './AttestationModal';
import { FactValidationPanel } from './FactValidationPanel';
import { EntityTimelinePanel } from './EntityTimelinePanel';
import { StaleAttestationBanner } from './StaleAttestationBanner';
import { ReturnWatchPanel } from './ReturnWatchPanel';
import { HandoffPanel } from './HandoffPanel';

// A post predating mcp migration 016 has sections: null. Normalizing to seven
// empty strings lets the editor open it and re-section it in place; the linter
// blocks publish until every section carries prose.
function normalizeSections(raw: DeskSections | null): DeskSections {
  const out = {} as DeskSections;
  for (const key of SECTION_KEYS) out[key] = raw?.[key] ?? '';
  return out;
}

interface Props {
  initialPost: DeskPost;
  initialAttestations: DeskAttestation[];
  context: DeskContext | null;
  initialUpdates: DeskPostUpdate[];
  returnWatchCandidateId?: string;
}

export function DeskEditorView({
  initialPost,
  initialAttestations,
  context,
  initialUpdates,
  returnWatchCandidateId,
}: Props) {
  const [post, setPost] = useState(initialPost);
  const [attestations, setAttestations] = useState(initialAttestations);
  const [sections, setSections] = useState(() => normalizeSections(initialPost.sections));
  const [meta, setMeta] = useState<DeskMeta>(initialPost.meta ?? {});
  const [title, setTitle] = useState(initialPost.title);
  const [blockersPresent, setBlockersPresent] = useState(false);

  const latestAttestation = attestations[0] ?? null;
  // Stale = there is an attestation but the post has been edited since (status
  // reverted to DRAFT, or the body hash no longer matches the snapshot). Advisory
  // only; the publish gate's hash_match is the real enforcement.
  const isStale =
    !!latestAttestation &&
    (post.status === 'DRAFT' || post.content_hash !== latestAttestation.content_hash);

  function handleAttested(att: DeskAttestation) {
    setAttestations((prev) => [att, ...prev]);
    setPost((prev) => ({ ...prev, status: 'READY', attestation_id: att.id }));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/desk" className="text-xs text-slate-500 hover:text-slate-300">
          ← Injury Desk
        </Link>
        <span className="text-xs text-slate-600 tabular-nums">v{post.version} · /{post.slug}</span>
      </div>

      <StaleAttestationBanner show={isStale} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <DraftEditor
            deskPostId={post.id}
            sections={sections}
            meta={meta}
            title={title}
            status={post.status}
            onSectionsChange={setSections}
            onMetaChange={setMeta}
            onTitleChange={setTitle}
            onSaved={setPost}
          />
        </div>

        <div className="space-y-4">
          <LinterRail
            deskPostId={post.id}
            markdown={post.markdown_body}
            onBlockersChange={setBlockersPresent}
          />
          <AttestationModal
            deskPostId={post.id}
            status={post.status}
            blockersPresent={blockersPresent}
            isStale={isStale}
            onAttested={handleAttested}
            onPublished={setPost}
          />
          <FactValidationPanel context={context} />
          <EntityTimelinePanel updates={context?.updates ?? []} />
          {(post.status === 'PUBLISHED' || post.status === 'RETRACTED') && (
            <HandoffPanel post={post} onConfirmed={setPost} />
          )}
          {post.status === 'PUBLISHED' && (
            <ReturnWatchPanel
              deskPostId={post.id}
              initialUpdates={initialUpdates}
              candidateId={returnWatchCandidateId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
