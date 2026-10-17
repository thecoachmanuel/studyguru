'use client';

/**
 * EliteIcon renders exact SVG assets from Elite Quiz App (assets/images and bottom_nav_icons)
 * with pixel-perfect tinting via CSS mask or SVG images.
 */
export default function EliteIcon({
  name,
  active = false,
  size = 22,
  color,
  className = '',
  style = {},
}) {
  // Map common names to file paths in /elite_assets/images/
  const iconMap = {
    // Nav icons
    home: active ? '/elite_assets/images/bottom_nav_icons/home_active_icon.svg' : '/elite_assets/images/bottom_nav_icons/home_icon.svg',
    quiz_zone: active ? '/elite_assets/images/bottom_nav_icons/quiz_zone_active_icon.svg' : '/elite_assets/images/bottom_nav_icons/quiz_zone_icon.svg',
    play_zone: active ? '/elite_assets/images/bottom_nav_icons/play_zone_active_icon.svg' : '/elite_assets/images/bottom_nav_icons/play_zone_icon.svg',
    leaderboard: active ? '/elite_assets/images/bottom_nav_icons/leaderboard_active_icon.svg' : '/elite_assets/images/bottom_nav_icons/leaderboard_icon.svg',
    profile: active ? '/elite_assets/images/bottom_nav_icons/profile_active_icon.svg' : '/elite_assets/images/bottom_nav_icons/profile_icon.svg',
    
    // Core game & menu icons
    wallet: '/elite_assets/images/wallet_icon.svg',
    coin_history: '/elite_assets/images/coinhistory.svg',
    invite_friends: '/elite_assets/images/invite_friends.svg',
    bookmark: '/elite_assets/images/bookmark.svg',
    badges: '/elite_assets/images/badges_icon.svg',
    rewards: '/elite_assets/images/reword_icon.svg',
    statistics: '/elite_assets/images/statistics_icon.svg',
    theme: '/elite_assets/images/theme_icon.svg',
    volume: '/elite_assets/images/volume_icon.svg',
    vibration: '/elite_assets/images/vibration_icon.svg',
    about_us: '/elite_assets/images/aboutus_icon.svg',
    how_to_play: '/elite_assets/images/how_to_play_icon.svg',
    share: '/elite_assets/images/share_icon.svg',
    rate_us: '/elite_assets/images/rate_icon.svg',
    logout: '/elite_assets/images/logout_icon.svg',
    delete_account: '/elite_assets/images/delete_acc.svg',
    edit: '/elite_assets/images/edit_icon.svg',
    notification: '/elite_assets/images/notification_icon.svg',
    coin: '/elite_assets/images/coin.svg',
    daily_coins: '/elite_assets/images/daily_coins.svg',
    
    // Game mode icons
    group_battle: '/elite_assets/images/group_battle_icon.svg',
    one_vs_one: '/elite_assets/images/one_vs_one_icon.svg',
    exam: '/elite_assets/images/exam_icon.svg',
    self_challenge: '/elite_assets/images/self_challenge.svg',
    daily_quiz: '/elite_assets/images/daily_quiz_icon.svg',
    fun_learn: '/elite_assets/images/fun_icon.svg',
    guess_word: '/elite_assets/images/guess_icon.svg',
    audio_quiz: '/elite_assets/images/audio_icon.svg',
    maths: '/elite_assets/images/maths_icon.svg',
    true_false: '/elite_assets/images/true_false_icon.svg',
    multi_match: '/elite_assets/images/multi_match_icon.svg',
    
    // Lifelines
    fifty_fifty: '/elite_assets/images/lifeline_fiftyfifty.svg',
    audience_poll: '/elite_assets/images/lifeline_audiencepoll.svg',
    reset_time: '/elite_assets/images/lifeline_resettime.svg',
    skip: '/elite_assets/images/lifeline_skip.svg',
    
    // Ranks
    rank_1: '/elite_assets/images/rank_1.svg',
    rank_2: '/elite_assets/images/rank_2.svg',
    rank_3: '/elite_assets/images/rank_3.svg',
  };

  const assetPath = iconMap[name] || (name.startsWith('/') ? name : `/elite_assets/images/${name}.svg`);

  // Default color logic matching Elite Quiz theme
  const resolvedColor = color || (active ? 'var(--primary-color)' : 'currentColor');

  return (
    <span
      className={`elite-icon-mask ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        backgroundColor: resolvedColor,
        WebkitMaskImage: `url("${assetPath}")`,
        maskImage: `url("${assetPath}")`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        transition: 'background-color 0.15s ease, transform 0.15s ease',
        ...style,
      }}
      aria-hidden="true"
    />
  );
}
