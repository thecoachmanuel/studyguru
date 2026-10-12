import Pusher from 'pusher';

let pusherServerInstance = null;

export function getPusherServer() {
  if (!pusherServerInstance) {
    pusherServerInstance = new Pusher({
      appId: process.env.PUSHER_APP_ID || '',
      key: process.env.NEXT_PUBLIC_PUSHER_KEY || '',
      secret: process.env.PUSHER_SECRET || '',
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'mt1',
      useTLS: true,
    });
  }
  return pusherServerInstance;
}

export default getPusherServer;
