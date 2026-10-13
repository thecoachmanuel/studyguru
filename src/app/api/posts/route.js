import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDatabase, safeObjectId } from '@/lib/mongodb';
import { getPusherServer } from '@/lib/pusherServer';

// Seed posts for initial community experience if database is empty
const INITIAL_DEMO_POSTS = [
  {
    id: 'p-seed-1',
    author: {
      id: 'u-sarah',
      name: 'Sarah Chen',
      username: 'schen_ai',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
      followersCount: 42,
      bio: 'Senior studying AI & Computational Neuroscience · Passionate about vector calculus & transformers.',
    },
    tag: '#CalculusIII',
    text: 'Just finished deriving Stokes’ Theorem with vector line integrals! 📐 Remember: boundary orientation must always match the surface normal by the right-hand rule.',
    attachment_url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&auto=format&fit=crop&q=80',
    likes_count: 14,
    liked_by: [],
    comments_count: 2,
    comments: [
      {
        id: 'c-seed-1',
        author: {
          id: 'u-jordan',
          name: 'Jordan Lee',
          avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80',
        },
        text: 'This breakdown is so helpful! Can you also share your cheat sheet for polar coordinates?',
        created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        likes: 3,
        liked: false,
      },
      {
        id: 'c-seed-2',
        author: {
          id: 'u-maya',
          name: 'Maya Patel',
          avatar_url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80',
        },
        text: 'Agreed! We covered this exact proof in lecture yesterday. Good catch on the surface orientation.',
        created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        likes: 1,
        liked: false,
      },
    ],
    created_at: new Date(Date.now() - 1000 * 60 * 25),
  },
  {
    id: 'p-seed-2',
    author: {
      id: 'u-alex',
      name: 'Alex Rivera',
      username: 'arivera_cs',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
      followersCount: 31,
      bio: 'Computer Science Major · Building open-source machine learning tooling.',
    },
    tag: '#MachineLearning',
    text: 'Flashcards on Attention Mechanisms & Self-Attention matrices (Q, K, V) are now uploaded to the AI section. Quiz mode is active! 🚀',
    attachment_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
    likes_count: 28,
    liked_by: [],
    comments_count: 1,
    comments: [
      {
        id: 'c-seed-3',
        author: {
          id: 'u-sarah',
          name: 'Sarah Chen',
          avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        },
        text: 'Loving the flashcards! Testing my active recall before exams.',
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        likes: 2,
        liked: false,
      },
    ],
    created_at: new Date(Date.now() - 1000 * 60 * 60),
  },
];

export async function GET(req) {
  try {
    const session = await auth();
    const currentUserId = session?.user?.id ? String(session.user.id) : null;

    let db = null;
    try {
      db = await getDatabase();
    } catch {}

    if (!db) {
      // Return formatted demo posts if db is offline
      const formatted = INITIAL_DEMO_POSTS.map((p) => ({
        id: p.id,
        author: p.author,
        tag: p.tag,
        text: p.text,
        attachmentUrl: p.attachment_url,
        likes: p.likes_count,
        liked: Boolean(currentUserId && p.liked_by?.includes(currentUserId)),
        comments: p.comments_count,
        commentsList: p.comments || [],
        timestamp: 'Recently',
        created_at: p.created_at,
      }));
      return NextResponse.json(formatted);
    }

    const postsCol = db.collection('posts');
    const count = await postsCol.countDocuments();
    if (count === 0) {
      // Seed initial posts
      await postsCol.insertMany(INITIAL_DEMO_POSTS);
    }

    const posts = await postsCol.find({}).sort({ created_at: -1 }).limit(50).toArray();

    const formatted = posts.map((p) => {
      const postId = p._id ? p._id.toString() : p.id;
      const likedBy = Array.isArray(p.liked_by) ? p.liked_by.map(String) : [];
      const isLiked = Boolean(currentUserId && likedBy.includes(currentUserId));
      const commentsList = (p.comments || []).map((c) => ({
        id: c.id || (c._id ? c._id.toString() : `c-${Date.now()}`),
        author: c.author || {
          id: c.user_id,
          name: c.author_name || 'Scholar',
          avatar_url: c.author_avatar || null,
        },
        text: c.text,
        timestamp: c.created_at ? formatTimeAgo(new Date(c.created_at)) : 'Just now',
        likes: c.likes || 0,
        liked: Boolean(currentUserId && c.liked_by?.map(String).includes(currentUserId)),
      }));

      return {
        id: postId,
        author: p.author || {
          id: p.author_id,
          name: p.author_name || 'Scholar',
          username: p.author_username || 'scholar',
          avatar_url: p.author_avatar || null,
          followersCount: p.author_followers_count || 12,
          bio: p.author_bio || 'Study enthusiast',
        },
        tag: p.tag || '#StudyNotes',
        text: p.text,
        attachmentUrl: p.attachment_url || null,
        likes: p.likes_count || (Array.isArray(p.liked_by) ? p.liked_by.length : 0),
        liked: isLiked,
        comments: p.comments_count || commentsList.length,
        commentsList,
        timestamp: p.created_at ? formatTimeAgo(new Date(p.created_at)) : 'Just now',
        created_at: p.created_at,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String(session.user.id);
    const body = await req.json().catch(() => ({}));
    const { text = '', tag = '#StudyNotes', attachmentUrl = null } = body;

    if (!text || !text.trim()) {
      return NextResponse.json({ error: 'Post text cannot be empty' }, { status: 400 });
    }

    const db = await getDatabase();
    const userDoc = await db.collection('users').findOne({
      $or: [{ _id: safeObjectId(userId) }, { id: userId }],
    });

    const now = new Date();
    const author = {
      id: userId,
      name: userDoc?.name || session.user.name || 'Scholar',
      username: userDoc?.username || userDoc?.name?.toLowerCase().replace(/\s+/g, '_') || 'scholar',
      avatar_url: userDoc?.avatar_url || session.user.image || null,
      followersCount: userDoc?.followers_count || 5,
      bio: userDoc?.bio || 'Passionate student on StudyCord',
    };

    const newPost = {
      author,
      author_id: userId,
      tag: tag.startsWith('#') ? tag : `#${tag}`,
      text: text.trim(),
      attachment_url: attachmentUrl,
      likes_count: 0,
      liked_by: [],
      comments_count: 0,
      comments: [],
      created_at: now,
    };

    const res = await db.collection('posts').insertOne(newPost);
    const postId = res.insertedId.toString();

    const formattedPost = {
      id: postId,
      author,
      tag: newPost.tag,
      text: newPost.text,
      attachmentUrl: newPost.attachment_url,
      likes: 0,
      liked: false,
      comments: 0,
      commentsList: [],
      timestamp: 'Just now',
      created_at: now,
    };

    // Broadcast real-time new post via Pusher
    try {
      const pusher = getPusherServer();
      if (pusher) {
        await pusher.trigger('feed', 'new-post', formattedPost);
      }
    } catch (pushErr) {
      console.warn('Pusher broadcast warning for new post:', pushErr.message);
    }

    return NextResponse.json(formattedPost, { status: 201 });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json({ error: error.message || 'Failed to create post' }, { status: 500 });
  }
}

function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
