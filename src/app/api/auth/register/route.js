import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(req) {
  try {
    const body = await req.json();
    const { email, password, username, fullName } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const db = await getDatabase();
    const existing = await db.collection('users').findOne({ email: normalizedEmail });

    if (existing) {
      return NextResponse.json(
        { error: 'A user with this email address already exists.' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();

    const newUser = {
      email: normalizedEmail,
      name: fullName || username || normalizedEmail.split('@')[0],
      username: (username || normalizedEmail.split('@')[0]).toLowerCase().trim(),
      password_hash: passwordHash,
      avatar_url: null,
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection('users').insertOne(newUser);

    return NextResponse.json(
      {
        message: 'Account created successfully.',
        user: {
          id: result.insertedId.toString(),
          email: newUser.email,
          name: newUser.name,
          username: newUser.username,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during registration.' },
      { status: 500 }
    );
  }
}
