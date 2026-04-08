import type { InjuryPost } from '@/lib/types';
import { BreakingCard } from './BreakingCard';
import { TrackingCard } from './TrackingCard';
import { DeepDiveCard } from './DeepDiveCard';
import { ConflictFlagCard } from './ConflictFlagCard';

function PostCard({ post }: { post: InjuryPost }) {
  switch (post.content_type) {
    case 'BREAKING':
      return <BreakingCard post={post} />;
    case 'TRACKING':
      return <TrackingCard post={post} />;
    case 'DEEP_DIVE':
      return <DeepDiveCard post={post} />;
    case 'CONFLICT_FLAG':
      return <ConflictFlagCard post={post} />;
    default:
      return null;
  }
}

interface PostFeedProps {
  posts: InjuryPost[];
  hasMore: boolean;
  total: number;
}

export function PostFeed({ posts, hasMore, total }: PostFeedProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-slate-500">
        <p className="text-lg">No posts found.</p>
        <p className="text-sm mt-1">Try adjusting the filters above.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-slate-600 mb-4">{total} posts</p>
      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
      {hasMore && (
        <div className="mt-8 text-center">
          <p className="text-xs text-slate-500">Scroll or use filters to find more posts.</p>
        </div>
      )}
    </div>
  );
}
