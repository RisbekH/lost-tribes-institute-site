# LostTribesInstitute.com

The Lost Tribes Institute website. Netlify builds and publishes it from this repository.

## Posting an essay

1. Go to https://losttribesinstitute.com/admin and sign in with GitHub.
2. Click **New Essay**. Fill in the title, date and a one- or two-sentence summary.
3. Paste the essay from Google Docs into the **Essay** box.
4. Click **Publish**. The essay appears at the top of the Essays page in about a minute.

To save an essay without showing it on the site, turn on **Draft**, then publish. Turn Draft off later to make it public.

## How it fits together

- `content/essays/` holds one Markdown file per essay (written by the posting screen).
- `admin/` is the posting screen (Decap CMS).
- `scripts/build.mjs` copies the site into `dist/` and builds the Essays page, one page per essay, an RSS feed (`/essays.xml`) and the sitemap.
- All other pages (`index.html`, `library.html`, etc.) are edited by hand, as before.
