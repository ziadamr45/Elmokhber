import { NextRequest, NextResponse } from 'next/server';

// Prayer times API using Aladhan (free, no API key required)
// Supports Egypt location by default

interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

interface PrayerTimesResponse {
  success: boolean;
  times: PrayerTimes | null;
  nextPrayer?: {
    name: string;
    nameAr: string;
    time: string;
    minutesUntil: number;
  };
  currentDate: string;
  location: string;
  error?: string;
}

// Arabic names for prayers
const PRAYER_NAMES_AR: Record<string, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

// Get prayer times from Aladhan API
async function getPrayerTimesFromAPI(lat: number, lng: number): Promise<PrayerTimes | null> {
  try {
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    // Aladhan API - Egyptian General Authority of Survey method (method=5)
    const url = `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${lat}&longitude=${lng}&method=5`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.code === 200 && data.data?.timings) {
      return {
        Fajr: data.data.timings.Fajr,
        Sunrise: data.data.timings.Sunrise,
        Dhuhr: data.data.timings.Dhuhr,
        Asr: data.data.timings.Asr,
        Maghrib: data.data.timings.Maghrib,
        Isha: data.data.timings.Isha,
      };
    }

    return null;
  } catch (error) {
    console.error('[PrayerTimes] Error fetching from API:', error);
    return null;
  }
}

// Fallback prayer times for Cairo, Egypt (approximate)
function getFallbackPrayerTimes(): PrayerTimes {
  const today = new Date();
  const month = today.getMonth() + 1;

  // Approximate times based on season in Egypt
  const isSummer = month >= 5 && month <= 9;

  return {
    Fajr: isSummer ? '04:00' : '05:00',
    Sunrise: isSummer ? '05:30' : '06:30',
    Dhuhr: isSummer ? '12:00' : '12:00',
    Asr: isSummer ? '15:30' : '15:00',
    Maghrib: isSummer ? '18:30' : '17:30',
    Isha: isSummer ? '20:00' : '19:00',
  };
}

// Calculate next prayer
function getNextPrayer(times: PrayerTimes): { name: string; nameAr: string; time: string; minutesUntil: number } {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

  for (const prayer of prayers) {
    const [hours, minutes] = times[prayer].split(':').map(Number);
    const prayerMinutes = hours * 60 + minutes;

    if (prayerMinutes > currentMinutes) {
      return {
        name: prayer,
        nameAr: PRAYER_NAMES_AR[prayer],
        time: times[prayer],
        minutesUntil: prayerMinutes - currentMinutes,
      };
    }
  }

  // If all prayers passed, return next day's Fajr
  const [fajrHours, fajrMinutes] = times.Fajr.split(':').map(Number);
  const fajrMinutesTotal = fajrHours * 60 + fajrMinutes;
  const minutesUntilFajr = (24 * 60 - currentMinutes) + fajrMinutesTotal;

  return {
    name: 'Fajr',
    nameAr: PRAYER_NAMES_AR['Fajr'],
    time: times.Fajr,
    minutesUntil: minutesUntilFajr,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '30.0444'); // Cairo default
    const lng = parseFloat(searchParams.get('lng') || '31.2357');

    // Try to get from API
    let prayerTimes = await getPrayerTimesFromAPI(lat, lng);

    // Fallback if API fails
    if (!prayerTimes) {
      console.log('[PrayerTimes] Using fallback times');
      prayerTimes = getFallbackPrayerTimes();
    }

    const nextPrayer = getNextPrayer(prayerTimes);

    const response: PrayerTimesResponse = {
      success: true,
      times: prayerTimes,
      nextPrayer,
      currentDate: new Date().toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      location: 'مصر',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[PrayerTimes] Error:', error);
    return NextResponse.json(
      { success: false, times: null, error: 'حدث خطأ في الحصول على مواعيد الصلاة' },
      { status: 500 }
    );
  }
}
