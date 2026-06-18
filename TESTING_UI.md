# UI Testing Guide — Social Mockups & Output Tabs

## Quick Start: Test the Two-Tab Output Interface

The dev server is running on `http://localhost:3000`. To test the Campaign Creator UI:

### 1. Authenticate (one-time setup)

```bash
curl -X POST http://localhost:3000/api/auth/dev-login \
  -H "Content-Type: application/json" \
  -d '{"brand_name": "Test Restaurant"}'
```

Response:

```json
{
  "message": "Dev login successful",
  "userId": "11111111-1111-1111-1111-111111111111",
  "brandId": "YOUR_BRAND_ID",
  "brandName": "Test Restaurant"
}
```

### 2. Access the App

Open `http://localhost:3000` in your browser. The session cookie will be set from the dev-login call.

### 3. Start a Campaign

- Click **"Start New Campaign"**
- Select a photo template (e.g., "Hero Close-up")
- Wait for generation (caption + brand voice selection)

### 4. QA the Output Tabs

After generation completes, you should see two tabs below the "Output" accordion:

#### Tab 1: **Outputs** (default)

- ✓ Image section with preview + Regenerate & Download buttons
- ✓ Caption section with copy button + Regenerate & Download buttons
- ✓ Video section (if available) with preview + Regenerate & Download buttons

#### Tab 2: **Previews**

- ✓ 5 platform preview tabs at the top:
  - **IG Feed** — 1:1 square, Instagram feed chrome
  - **IG Reels** — 9:16 vertical, Reels UI overlay
  - **TikTok** — 9:16 vertical, TikTok UI overlay
  - **Facebook** — Feed post, older demographic styling
  - **Meta Ad** — Same as Facebook with "Sponsored" badge + CTA button
- ✓ Each tab displays: image/video + caption + hashtags (where applicable)
- ✓ Media fills the frame properly
- ✓ Caption truncates cleanly on all platforms

### 5. Action Bar (Below Outputs)

Test these buttons:

- **Save to Archive** — saves the current campaign to Previous Outputs
- **Download All** — packages image + caption + video as ZIP
- **New Campaign** — clears the form, starts fresh

## What to Look For

### Visual Checks

- [ ] Tab switching is instant and smooth
- [ ] Social mockups render without text overflow
- [ ] Platform chrome (buttons, headers, footers) look accurate
- [ ] Media doesn't distort or crop unexpectedly
- [ ] Captions are readable (not too long, no emoji/symbol weirdness)

### Functional Checks

- [ ] Regenerate buttons in Outputs tab work independently (image/caption/video)
- [ ] Download buttons export the correct file format
- [ ] Switching platforms doesn't reset other tab state
- [ ] Action bar buttons respond without errors

## Known Limitations (As of May 27)

1. **Video Generation Blocked** — Veo API quota exhausted. Quota resets at midnight PT. Dining-moment.mp4 from May 27 10:57 is available for testing Previews tab with video.
2. **Single Photo** — MVP supports one photo at a time. Multi-photo analysis is post-MVP.
3. **No Publishing** — Downloads only. Social platform APIs not integrated.

## If Something Breaks

Check the browser console (F12 → Console) for errors. If you see TypeScript errors:

- Verify `pnpm type-check` passes
- Restart dev server: `pkill -f 'next dev'` then `pnpm dev`

If the dev-login endpoint fails:

- Check the server log: `tail -20 /tmp/dev.log`
- Ensure Supabase connection is working (check `.env.local`)

---

**Test data available:** All template photos + videos in `public/templates/`  
**Next priority:** Once UI testing is done, regen dining-moment video when quota resets
