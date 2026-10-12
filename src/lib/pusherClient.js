import PusherClient from 'pusher-js';

let pusherClientInstance = null;

export function getPusherClient() {
  if (typeof window === 'undefined') return null;

  if (!pusherClientInstance) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY || 'studycord-key';
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1';
    
    pusherClientInstance = new PusherClient(key, {
      cluster,
      authEndpoint: '/api/pusher/auth',
    });
  }
  return pusherClientInstance;
}

export default getPusherClient;
