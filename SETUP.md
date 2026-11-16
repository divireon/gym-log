# Gym Log: sync and phone setup

Gym Log saves everything on your device first, so it works with no signal. Cloud sync copies it to a
free Supabase database so your phone and computer show the same data. The app itself is hosted for free on
GitHub Pages so you can install it on your phone.

## 1. Supabase (the database), about 10 minutes

1. Go to **supabase.com**, click **Start your project**, and create a free account.
2. Click **New project**:
   - Name: `gym-log`
   - Database password: click **Generate**, then save it in your password manager. The app never needs it.
   - Region: the one closest to you.
   - Plan: Free.
   - Wait a minute or two while it sets up.
3. In the left sidebar, open **SQL Editor** and click **New query**. Paste everything from
   [`supabase/setup.sql`](supabase/setup.sql) and click **Run**. You should see *Success. No rows returned*.
4. Create your login. Go to **Authentication → Users → Add user → Create new user**, enter your email
   and a password you choose, tick **Auto Confirm User**, and click **Create user**. This is what you'll sign in
   with inside the app.
5. Lock the door. Go to **Authentication → Sign In / Providers** and turn **off**
   *Allow new users to sign up*, then save. Now nobody else can create an account in your database.
6. Get the two connection values from **Project Settings → API Keys** (or the **Connect** button at the top):
   - **Project URL**: looks like `https://abcd1234.supabase.co`
   - **Publishable key**: starts with `sb_publishable_`. If you only see legacy keys, use the **anon public** one.

   Paste both to Claude. They're designed to be public, so that's safe.
   **Never share the `secret` / `service_role` key or your database password.**

> Note: free Supabase projects pause after about a week with no activity. Nothing is lost, and the app keeps
> working offline. If it says it can't sync after a long break, open supabase.com and click **Restore project**.

## 2. GitHub (hosting the app), about 10 minutes

1. Create a free account at **github.com** if you don't have one.
2. Click **+ → New repository**. Name it `gym-log`, set it to **Public** (required for free GitHub Pages; only
   the app's code goes there, never your workout data), and leave every other box unticked. Click
   **Create repository**.
3. Tell Claude your GitHub username. Claude commits the code and pushes it. The first push opens a browser
   window asking you to sign in to GitHub; that's Git Credential Manager, and it's expected.
4. In the repository, go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**,
   pick branch **main** and folder **/ (root)**, and click **Save**. About a minute later the app is live at
   `https://<your-username>.github.io/gym-log/`.

## 3. Your phone

1. **iPhone:** open the link in **Safari**, tap **Share**, then **Add to Home Screen**.
   **Android:** open it in **Chrome**, tap **⋮**, then **Install app**.
2. Open Gym Log from the home screen, go to **Settings → Cloud sync**, and sign in with the login from step 1.4.
3. Do the same on your computer's browser. Both stay in sync.

## Updating the app later

After a code change, bump `CACHE` in `sw.js` and push to GitHub. The phone picks up the new version the next
time it's opened with a connection, and shows it the time after that.
