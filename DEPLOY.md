# ডিপ্লয় গাইড — PC → GitHub → Vercel → Neon

> সময় লাগবে প্রায় ২০–৩০ মিনিট। প্রতিটি ধাপের শেষে "✔ নিশ্চিত করুন" দেখে এগোবেন।

## ০. আগে যা লাগবে (একবারই)
| কী | কোথায় | যাচাই |
|---|---|---|
| Node.js **22** | nodejs.org (LTS) | `node -v` → v22.x |
| Git | git-scm.com | `git --version` |
| VS Code (ঐচ্ছিক) | code.visualstudio.com | |
| GitHub অ্যাকাউন্ট | github.com | |
| Vercel অ্যাকাউন্ট | vercel.com → "Continue with GitHub" (Hobby) | |
| Vercel CLI | `npm i -g vercel` | `vercel --version` |

## ১. ফোল্ডার PC-তে বসানো
1. `landtech.zip` আনজিপ করে `D:\landtech` (বা যেকোনো ফোল্ডারে) রাখুন।
2. VS Code বা টার্মিনালে ফোল্ডারটি খুলুন:
   ```
   cd D:\landtech
   npm install
   npm run check      # ফাংশন সংখ্যা, rewrite, URL, সিনট্যাক্স যাচাই
   npm test           # সম্পূর্ণ API টেস্ট (ইন্টারনেট/ডাটাবেস ছাড়াই)
   ```
   ✔ নিশ্চিত করুন: `npm run check` শেষে "সব ঠিক আছে", `npm test` শেষে "86 passed, 0 failed"।

## ২. GitHub-এ পাঠানো
1. github.com → **New repository** → নাম `landtech-portal` → **README/.gitignore/license যোগ করবেন না** (খালি রাখুন) → Create।
2. টার্মিনালে:
   ```
   git init -b main
   git add .
   git commit -m "LandTech portal: first commit"
   git remote add origin https://github.com/<আপনার-ইউজারনেম>/landtech-portal.git
   git push -u origin main
   ```
   ✔ নিশ্চিত করুন: GitHub পেজে ফাইল দেখা যাচ্ছে, কিন্তু `.env` ও `node_modules` নেই (`.gitignore` এগুলো আটকায়)। কিছুক্ষণ পর **Actions** ট্যাবে সবুজ টিক আসবে।

## ৩. Vercel-এ ইমপোর্ট
1. vercel.com/new → GitHub রিপো `landtech-portal` → **Import**।
2. **Framework Preset: Other**। Build Command / Output Directory / Install Command — সব **খালি** রাখুন।
3. **Environment Variables** → যোগ করুন:
   - `JWT_SECRET` = লম্বা র‍্যান্ডম স্ট্রিং (টার্মিনালে `npm run gen:secret` চালিয়ে কপি করুন)। Production, Preview, Development — তিনটিই টিক।
4. **Deploy** চাপুন। (Node সংস্করণ `package.json`-এর `engines` থেকে ২২ ধরবে।)

   এই প্রথম ডিপ্লয়ে সাইট খুলবে, কিন্তু লগইন ইত্যাদি এখনো চলবে না — ডাটাবেস নেই। এটা স্বাভাবিক।

## ৪. Neon ডাটাবেস সংযোগ (সবচেয়ে সহজ উপায়)
1. Vercel প্রজেক্ট → **Storage** ট্যাব → **Create Database** → **Neon** → Region: **Singapore** (বাংলাদেশের সবচেয়ে কাছে) → Create।
2. **Connect Project** → `landtech-portal` → Environments: Production, Preview, Development → Connect।
3. Settings → Environment Variables-এ `DATABASE_URL` (ও `DATABASE_URL_UNPOOLED`) নিজে থেকেই এসে যাবে।

> বিকল্প: neon.tech-এ নিজে প্রজেক্ট বানিয়ে **Connection string (pooled)** কপি করে Vercel-এ `DATABASE_URL` নামে হাতে বসান।

✔ নিশ্চিত করুন: Environment Variables-এ `DATABASE_URL` ও `JWT_SECRET` দুটোই আছে।

## ৫. ডাটাবেসে টেবিল ও ডেমো ডেটা বসানো (এক কমান্ডে)
```
vercel login
vercel link                 # প্রশ্নে: আপনার প্রজেক্টটি বেছে নিন
vercel env pull .env        # DATABASE_URL পিসিতে .env ফাইলে নামবে (গিটে যাবে না)
npm run db:setup            # schema + seed
npm run db:check            # টেবিলের সংখ্যা ও hash chain যাচাই
```
- ডেমো ডেটা মুছে নতুন করে শুরু করতে: `npm run db:reset`।
- বিকল্প (কমান্ড ছাড়া): Neon কনসোলের **SQL Editor**-এ `db/schema.sql` পেস্ট করে Run, তারপর `db/seed.sql`।

✔ নিশ্চিত করুন: `db:check` লিখছে "hash chain অক্ষত"।

## ৬. পুনরায় ডিপ্লয় ও যাচাই
1. Vercel → **Deployments** → সর্বশেষটির `⋯` → **Redeploy** (নতুন env ভ্যারিয়েবল কাজে লাগাতে এটি দরকার)।
2. টার্মিনালে:
   ```
   npm run smoke -- https://আপনার-অ্যাপ.vercel.app
   ```
   ✔ নিশ্চিত করুন: সব লাইনে ✔, শেষে "ফেল 0"। (এটি শুধু পড়ে; ডেটা বদলায় না; নাগরিক টোকেনের ১টি ব্যবহার খরচ হয়।)
3. ব্রাউজারে লগইন করুন: `registrar_demo` / `Demo@1234`।

## ৭. পরে প্রতিদিনের কাজ
```
# কোড বদলান
npm run check && npm test
git add . && git commit -m "কী বদলালেন"
git push                    # Vercel নিজে ডিপ্লয় করে
```
- অন্য branch-এ push করলে Vercel একটি **Preview** লিংক দেয় — মূল সাইট না ছুঁয়ে পরীক্ষা করা যায়।
- লোকালে চালাতে: `npm run dev` (= `vercel dev`) → http://localhost:3000

## ৮. ১২-ফাংশনের সীমা রক্ষা (Hobby)
আপনার ফোল্ডারে ফাংশন ৮টি: `api/auth, lookup, land, registry, bank, citizen, verify, ocr-check`।
**নতুন API route যোগ করার নিয়ম** (নতুন ফাইল `api/`-তে রাখবেন না):
1. হ্যান্ডলার লিখুন `api/_handlers/নাম.js`-এ (`_` দিয়ে শুরু ফোল্ডার ফাংশন গোনা হয় না)।
2. কাছের dispatcher-এ (যেমন `api/registry.js`) এক লাইনে যোগ করুন।
3. `vercel.json`-এর `rewrites`-এ URL যোগ করুন।
4. `npm run check` চালান — সংখ্যা ১২ ছাড়ালে বা rewrite ভুল হলে এটি থামিয়ে দেবে।

## ৯. সমস্যা হলে
| লক্ষণ | কারণ ও সমাধান |
|---|---|
| ডিপ্লয় ফেল: "No more than 12 Serverless Functions" | `npm run check` চালান; `api/`-তে `_` ছাড়া বাড়তি ফাইল সরান |
| লগইনে "সার্ভারে সমস্যা হয়েছে" | Vercel → Logs দেখুন। সাধারণত `JWT_SECRET`/`DATABASE_URL` নেই — যোগ করে **Redeploy** |
| env বদলিয়েও কাজ হয় না | env বদলালে অবশ্যই Redeploy লাগে |
| `db:setup` বলছে "টেবিল ইতিমধ্যে আছে" | ঠিকই আছে; নতুন করে বানাতে `npm run db:reset` |
| `vercel env pull` এ `DATABASE_URL` আসেনি | Storage → Neon → Connect Project-এ Development টিক আছে কি দেখুন; না হলে Neon কনসোল থেকে হাতে `.env`-এ বসান |
| `node: --env-file is not allowed` / অজানা অপশন | Node পুরোনো; Node 22 ইনস্টল করুন |
| প্রথম অনুরোধ কিছুটা ধীর | Neon ফ্রি ডাটাবেস নিষ্ক্রিয় থাকলে ঘুমিয়ে যায়; জাগতে ১ সেকেন্ডের মতো লাগে — স্বাভাবিক |
| নতুন কিছু লোকালে চলে, Vercel-এ না | `git push` করেছেন কি? Vercel → Deployments-এ সর্বশেষটি সবুজ কি? |

## ১০. নিরাপত্তা-স্মরণ
- `.env` কখনো গিটে দেবেন না (`.gitignore`-এ আছে)।
- ডেমো পাসওয়ার্ড (`Demo@1234`) ও ডেমো টোকেন শুধু প্রদর্শনের জন্য; বাস্তব ব্যবহারে `db/seed.sql` থেকে সরান।
- Vercel Hobby প্ল্যান ব্যক্তিগত/অবাণিজ্যিক ব্যবহারের জন্য।
