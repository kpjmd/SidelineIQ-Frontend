export type Sport = 'NFL' | 'NBA' | 'PREMIER_LEAGUE' | 'UFC' | 'OTHER';
export type InjurySeverity = 'MINOR' | 'MODERATE' | 'SEVERE' | 'UNKNOWN';
export type ContentType = 'BREAKING' | 'TRACKING' | 'DEEP_DIVE' | 'CONFLICT_FLAG';
export type PostStatus = 'PUBLISHED' | 'PENDING_REVIEW' | 'DRAFT';
export type MdReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface InjuryPost {
  id: string;
  athlete_name: string;
  sport: Sport;
  team: string;
  injury_type: string;
  injury_severity: InjurySeverity;
  content_type: ContentType;
  headline: string;
  clinical_summary: string;
  return_to_play_min_weeks: number | null;
  return_to_play_max_weeks: number | null;
  rtp_probability_week_2: number | null;
  rtp_probability_week_4: number | null;
  rtp_probability_week_8: number | null;
  rtp_confidence: number | null;
  farcaster_hash: string | null;
  twitter_id: string | null;
  source_url: string | null;
  status: PostStatus;
  md_review_required: boolean;
  md_review_reason: string | null;
  md_review_confidence: number | null;
  conflict_reason: string | null;
  team_timeline_weeks: number | null;
  version: number;
  parent_post_id: string | null;
  slug: string | null;
  created_at: string;
  updated_at: string;
}

export interface MdReview {
  id: string;
  post_id: string;
  reason: string;
  status: MdReviewStatus;
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  // Joined from injury_posts
  athlete_name?: string;
  sport?: Sport;
  headline?: string;
  slug?: string | null;
}

export interface FeedResponse {
  posts: InjuryPost[];
  total: number;
  has_more: boolean;
  next_offset: number | null;
}

export interface ListPostsFilters {
  sport?: Sport;
  content_type?: ContentType;
  status?: PostStatus;
  limit?: number;
  offset?: number;
}
