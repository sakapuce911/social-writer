// src/app/LinkedInPreview.tsx
"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import styles from "./LinkedInPreview.module.css";

type Variant = "desktop" | "mobile";

type Props = {
  caption: string;
  cta: string;
  hashtags: string;

  // Options (fallbacks)
  authorName?: string;
  authorHeadline?: string;
  timeLabel?: string; // ex: "1 j"
  audienceLabel?: string; // ex: "Public"

  // ✅ rendu plus compact façon mobile LinkedIn
  variant?: Variant;
};

function extractHashtags(text: string) {
  return (text ?? "").match(/#[\p{L}\p{N}_]+/gu) ?? [];
}

function tokenizeHashtags(line: string) {
  const parts = line.split(/(\s+)/g);
  return parts.map((p, i) => {
    if (/^#[\p{L}\p{N}_]+$/u.test(p)) {
      return (
        <span key={i} className={styles.hashtag}>
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function clampByChars(text: string, limit: number) {
  const t = (text ?? "").trim();
  if (!t) return { clamped: "", isClamped: false };
  if (t.length <= limit) return { clamped: t, isClamped: false };

  const sliced = t.slice(0, limit);
  const safe = sliced.replace(/\s+$/g, "").trimEnd();
  return { clamped: safe, isClamped: true };
}

/** ✅ petit hash stable (pas crypto, juste pour stabiliser l’UI) */
function stableHash(input: string) {
  let h = 2166136261; // FNV-ish
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** ✅ format like LinkedIn: 999, 1,2k, 12k, 1,1M */
function formatCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(".", ",")}k`;
  if (n < 1000000) return `${Math.round(n / 1000)}k`;
  return `${(n / 1000000).toFixed(1).replace(".", ",")}M`;
}

/** ✅ stats “LinkedIn-like” : likes > comments > reposts */
function computeRealisticStats(fullText: string) {
  const text = (fullText ?? "").trim();
  const len = text.length;
  const lines = text.split("\n").filter(Boolean).length;

  const hash = stableHash(text);

  const structureBoost = clamp(lines, 1, 10) / 10; // 0.1..1
  const lengthBoost = clamp(len / 800, 0.2, 1.4); // 0.2..1.4

  const baseLikes = 80 + (hash % 920); // 80..999
  const boostedLikes = Math.round(baseLikes * (0.85 + structureBoost) * lengthBoost);

  const cRatio = 0.03 + ((hash >>> 3) % 9) / 100; // 0.03..0.11
  const comments = Math.max(0, Math.round(boostedLikes * cRatio));

  const rRatio = 0.006 + ((hash >>> 7) % 27) / 1000; // 0.006..0.033
  let reposts = Math.round(boostedLikes * rRatio);
  reposts = Math.min(reposts, Math.max(0, Math.round(comments * 0.7)));

  const likes = clamp(boostedLikes, 12, 32000);
  const cmts = clamp(comments, 0, Math.max(3, Math.round(likes * 0.2)));
  const reps = clamp(reposts, 0, Math.max(1, Math.round(cmts * 0.8)));

  return { likes, comments: cmts, reposts: reps };
}

/**
 * ✅ Rendu "LinkedIn-like"
 * - LinkedIn montre des paragraphes (blocs) séparés par des lignes vides.
 */
function splitIntoParagraphs(text: string) {
  const raw = (text ?? "").replace(/\r/g, "");
  const lines = raw.split("\n");

  const paragraphs: string[][] = [];
  let buf: string[] = [];

  for (const line of lines) {
    const t = line;
    if (!t.trim()) {
      if (buf.length) {
        paragraphs.push(buf);
        buf = [];
      }
      continue;
    }
    buf.push(t);
  }
  if (buf.length) paragraphs.push(buf);

  return paragraphs;
}

export default function LinkedInPreview({
  caption,
  cta,
  hashtags,
  authorName = "Vous",
  authorHeadline = "Créateur • SocialWriter",
  timeLabel = "1 j",
  audienceLabel = "Public",
  variant = "desktop",
}: Props) {
  const [expanded, setExpanded] = useState(false);

  // ✅ avatar = lettre (rendu stable et propre sans URL profil)
  const finalName = (authorName ?? "Vous").trim() || "Vous";
  const finalHeadline = (authorHeadline ?? "Créateur • SocialWriter").trim() || "Créateur • SocialWriter";

  const fullText = useMemo(() => {
    const parts = [(caption ?? "").trim(), (cta ?? "").trim(), (hashtags ?? "").trim()].filter(Boolean);
    return parts.join("\n\n").trim();
  }, [caption, cta, hashtags]);

  const clampLimit = variant === "mobile" ? 260 : 360;

  const { clamped, isClamped } = useMemo(() => clampByChars(fullText, clampLimit), [fullText, clampLimit]);
  const textToShow = expanded || !isClamped ? fullText : clamped;

  const hashCount = useMemo(() => extractHashtags(hashtags).length, [hashtags]);
  const stats = useMemo(() => computeRealisticStats(fullText), [fullText]);

  const feedClass = [styles.liFeed, variant === "mobile" ? styles.liFeedMobile : ""].join(" ").trim();
  const cardClass = [styles.liCard, variant === "mobile" ? styles.liCardMobile : ""].join(" ").trim();

  const paragraphs = useMemo(() => splitIntoParagraphs(textToShow), [textToShow]);

  return (
    <div className={feedClass} aria-label="Aperçu LinkedIn">
      <div className={cardClass} aria-label="Post LinkedIn">
        {/* Header */}
        <div className={styles.liHeader}>
          {/* Avatar */}
          <div className={styles.liAvatar} aria-hidden="true">
            {finalName.slice(0, 1).toUpperCase()}
          </div>

          <div className={styles.liHeaderMeta}>
            <div className={styles.liNameRow}>
              <div className={styles.liName}>{finalName}</div>
              <span className={styles.liDot}>•</span>
              <button className={styles.liFollow} type="button">
                + Suivre
              </button>
            </div>

            <div className={styles.liHeadline}>{finalHeadline}</div>

            <div className={styles.liSubRow}>
              <span>{timeLabel}</span>
              <span className={styles.liDot}>•</span>
              <span className={styles.liAudience}>
                <GlobeIcon />
                {audienceLabel}
              </span>
            </div>
          </div>

          <button className={styles.liMore} type="button" aria-label="Plus d’options">
            <MoreIcon />
          </button>
        </div>

        {/* Content */}
        <div className={styles.liBody}>
          <div className={styles.liText}>
            {paragraphs.length === 0 ? (
              <div className={styles.liLine} />
            ) : (
              paragraphs.map((paraLines, pIdx) => (
                <div key={pIdx} style={{ marginTop: pIdx === 0 ? 0 : 10 }}>
                  {paraLines.map((line, lIdx) => (
                    <div key={`${pIdx}-${lIdx}`} className={styles.liLine}>
                      {tokenizeHashtags(line)}
                    </div>
                  ))}
                </div>
              ))
            )}

            {!expanded && isClamped && <span>…</span>}
          </div>

          {isClamped && !expanded && (
            <button className={styles.liSeeMoreInline} type="button" onClick={() => setExpanded(true)}>
              … voir plus
            </button>
          )}

          {hashCount > 0 && <div className={styles.liHint}>Hashtags détectés : {hashCount}</div>}
        </div>

        {/* Reactions */}
        <div className={styles.liReactions}>
          <div className={styles.liReactionsLeft}>
            <span className={styles.liBadges} aria-hidden="true">
              <span className={styles.liBadge}>👍</span>
              <span className={styles.liBadge}>❤️</span>
              <span className={styles.liBadge}>👏</span>
            </span>
            <span className={styles.liCount}>{formatCount(stats.likes)}</span>
          </div>

          <div className={styles.liReactionsRight}>
            <span>
              {formatCount(stats.comments)} {stats.comments <= 1 ? "commentaire" : "commentaires"}
            </span>
            <span className={styles.liDot}>•</span>
            <span>
              {formatCount(stats.reposts)} {stats.reposts <= 1 ? "republication" : "republications"}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.liActions}>
          <ActionBtn icon={<LikeIcon />} label="J’aime" />
          <ActionBtn icon={<CommentIcon />} label="Commenter" />
          <ActionBtn icon={<RepostIcon />} label="Reposter" />
          <ActionBtn icon={<SendIcon />} label="Envoyer" />
        </div>

        {/* Comment bar */}
        <div className={styles.liCommentBar} aria-hidden="true">
          <div className={styles.liCommentAvatar}>{finalName.slice(0, 1).toUpperCase()}</div>
          <div className={styles.liCommentInput}>Ajouter un commentaire…</div>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button className={styles.liActionBtn} type="button">
      <span className={styles.liActionIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.liActionLabel}>{label}</span>
    </button>
  );
}

/* ===== Icons ===== */

function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className={styles.liIcon}>
      <path
        fill="currentColor"
        d="M12 2a10 10 0 1 0 0 20a10 10 0 0 0 0-20Zm7.93 9h-3.2a15.6 15.6 0 0 0-1.1-5.05A8.02 8.02 0 0 1 19.93 11ZM12 4c.88 0 2.27 2.08 3.02 7H8.98C9.73 6.08 11.12 4 12 4ZM4.07 13h3.2c.2 1.83.7 3.58 1.1 5.05A8.02 8.02 0 0 1 4.07 13Zm3.2-2h-3.2a8.02 8.02 0 0 1 4.3-5.05c-.4 1.47-.9 3.22-1.1 5.05Zm1.71 2h6.04c-.75 4.92-2.14 7-3.02 7c-.88 0-2.27-2.08-3.02-7Zm7.65 5.05c.4-1.47.9-3.22 1.1-5.05h3.2a8.02 8.02 0 0 1-4.3 5.05Z"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={styles.liIcon}>
      <path
        fill="currentColor"
        d="M12 7a2 2 0 1 1 0-4a2 2 0 0 1 0 4Zm0 7a2 2 0 1 1 0-4a2 2 0 0 1 0 4Zm0 7a2 2 0 1 1 0-4a2 2 0 0 1 0 4Z"
      />
    </svg>
  );
}

function LikeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={styles.liIcon}>
      <path
        fill="currentColor"
        d="M2 21h4V9H2v12Zm20-11c0-1.1-.9-2-2-2h-6.31l.95-4.57l.03-.32c0-.41-.17-.79-.44-1.06L13 1L6.59 7.41C6.22 7.78 6 8.3 6 8.83V19c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2Z"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={styles.liIcon}>
      <path
        fill="currentColor"
        d="M21 6h-18c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h4v3l4-3h10c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2Z"
      />
    </svg>
  );
}

function RepostIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={styles.liIcon}>
      <path
        fill="currentColor"
        d="M7 7h11l-2-2l1.4-1.4L22.8 9l-5.4 5.4L16 13l2-2H7V7Zm10 10H6l2 2L6.6 20.4L1.2 15l5.4-5.4L8 11l-2 2h11v4Z"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={styles.liIcon}>
      <path fill="currentColor" d="M2.01 21L23 12L2.01 3L2 10l15 2l-15 2l.01 7Z" />
    </svg>
  );
}