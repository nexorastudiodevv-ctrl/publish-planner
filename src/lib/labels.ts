import type { ContentStatus, ContentType, Platform } from './types';

export const contentTypeLabels: Record<ContentType, string> = {
  video: 'فيديو',
  reel: 'ريلز',
  post: 'منشور',
  story: 'ستوري',
};

export const platformLabels: Record<Platform, string> = {
  youtube: 'يوتيوب',
  tiktok: 'تيك توك',
  instagram: 'إنستغرام',
  facebook: 'فيسبوك',
  x: 'إكس',
  linkedin: 'لينكدإن',
  snapchat: 'سناب شات',
  telegram: 'تيليجرام',
  other: 'منصة أخرى',
};

export const statusLabels: Record<ContentStatus, string> = {
  scheduled: 'مجدول',
  published: 'تم النشر',
  cancelled: 'ملغي',
};

export const contentTypes = Object.keys(contentTypeLabels) as ContentType[];
export const platforms = Object.keys(platformLabels) as Platform[];
