# AMS RFQ

מערכת לניהול הצעות מחיר ורכש: העלאת BOM, קטלוג אוטומטי עם Gemini, שליחת בקשות לספקים, ופענוח תשובות לחישוב הצעת מחיר.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Auth, Postgres, Storage) · Gemini · Resend · Vercel

## הרצה מקומית

```bash
npm install
cp .env.example .env.local   # ולמלא את הערכים
npm run dev
```

## הקמת Supabase

1. ליצור פרויקט ב-supabase.com.
2. ב-SQL Editor להריץ את `supabase/migrations/0001_init.sql`.
3. ב-Authentication > Users ליצור משתמש (אימייל + סיסמה) עבור המשתמשת. ב-Authentication > Providers מומלץ לכבות הרשמה עצמית (Allow new users to sign up).
4. להעתיק URL ו-anon key מ-Project Settings > API ל-`.env.local`.

## פריסה ל-Vercel

לחבר את ה-repo ב-vercel.com, ולהגדיר את משתני הסביבה מ-`.env.example`.

## מפת דרכים

- [x] שלב 1: שלד, Auth, דשבורד פרויקטים, סכמת DB
- [ ] שלב 2: העלאת BOM ל-Storage ופענוח Excel
- [ ] שלב 3: קטלוג עם Gemini + ייצוא CSV
- [ ] שלב 4: ניהול ספקים ושליחה
- [ ] שלב 5: העלאה ידנית של תשובות (PDF / EML) ופענוח
- [ ] שלב 6: חישוב הצעת מחיר
