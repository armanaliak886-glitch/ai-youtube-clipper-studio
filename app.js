const $ = id => document.getElementById(id);
let selectedFile = null;
let analysis = null;
let apiKey = "";
const words = {
  hi: {
    heroTitle:"लंबे वीडियो से शानदार Shorts बनाइए",heroSub:"वीडियो अपलोड करें या YouTube लिंक का Preview देखें। AI से क्लिप सुझाव, कैप्शन और डबिंग तैयार करें।",
    sourceTitle:"वीडियो जोड़ें",sourceSub:"अपनी या उपयोग की अनुमति वाली वीडियो फ़ाइल चुनें।",uploadTab:"वीडियो अपलोड",youtubeTab:"YouTube लिंक",
    chooseVideo:"वीडियो चुनने के लिए टैप करें",fileTypes:"MP4, MOV, WebM या MKV",pasteUrl:"YouTube URL पेस्ट करें",preview:"Preview",
    ytHelp:"लिंक डालकर Preview दबाएँ। YouTube वीडियो यहाँ अपने आधिकारिक प्लेयर में खुलेगा।",ytNotice:"YouTube लिंक केवल Preview/AI संदर्भ के लिए है। क्लिप Export करने के लिए अनुमति प्राप्त MP4 अपलोड करें।",
    aiTitle:"AI वीडियो विश्लेषण",aiSub:"Gemini से Shorts के अच्छे हिस्से और captions सुझवाएँ।",analyze:"✨ वीडियो Analyze करें",summary:"वीडियो सारांश",clips:"Clip सुझाव",transcript:"Transcript",downloadSrt:"SRT डाउनलोड करें",
    trimTitle:"Clip काटें और Export करें",trimSub:"वीडियो फ़ाइल से चुने हुए समय का MP4 बनाएँ।",start:"शुरुआत (सेकंड)",end:"अंत (सेकंड)",exportClip:"✂ MP4 Clip Export करें",
    dubTitle:"AI Dubbing",dubSub:"स्क्रिप्ट को दूसरी भाषा में बदलकर AI आवाज़ बनाएँ।",dubText:"डबिंग के लिए टेक्स्ट / Transcript",targetLang:"आवाज़ की भाषा",makeDub:"🎙 Dubbing Audio बनाएँ",
    dubNote:"यदि वीडियो फ़ाइल चुनी है, तो AI आवाज़ के साथ नया MP4 भी बनाने की कोशिश होगी। यह मूल आवाज़ की जगह नई आवाज़ रखेगा।",
    apiTitle:"Google AI Studio API Connector",apiSub:"अपनी Gemini API Key जोड़ें।",apiKey:"Gemini API Key",show:"Show",hide:"Hide",testKey:"API जाँचें",
    keyNote:"Key केवल इस ब्राउज़र टैब की मेमोरी में रहती है और हर अनुरोध के साथ सर्वर को भेजी जाती है। इसे GitHub पर कभी अपलोड न करें।"
  },
  en: {
    heroTitle:"Turn long videos into great Shorts",heroSub:"Upload a video or preview a YouTube link. Use AI for clip ideas, captions and dubbing.",
    sourceTitle:"Add a video",sourceSub:"Choose a video you own or have permission to edit.",uploadTab:"Upload video",youtubeTab:"YouTube link",
    chooseVideo:"Tap to choose a video",fileTypes:"MP4, MOV, WebM or MKV",pasteUrl:"Paste YouTube URL",preview:"Preview",
    ytHelp:"Paste a link and tap Preview. The official YouTube player will open here.",ytNotice:"YouTube links are for preview/AI reference only. Upload an authorized MP4 to export clips.",
    aiTitle:"AI video analysis",aiSub:"Ask Gemini to suggest strong Shorts moments and captions.",analyze:"✨ Analyze video",summary:"Video summary",clips:"Clip suggestions",transcript:"Transcript",downloadSrt:"Download SRT",
    trimTitle:"Trim and export a clip",trimSub:"Create an MP4 from a selected time range.",start:"Start (seconds)",end:"End (seconds)",exportClip:"✂ Export MP4 clip",
    dubTitle:"AI Dubbing",dubSub:"Translate a script and generate an AI voice.",dubText:"Text / transcript to dub",targetLang:"Voice language",makeDub:"🎙 Generate dubbing audio",
    dubNote:"If a video is selected, the app will also try to create a new MP4 with the generated voice replacing the original audio.",
    apiTitle:"Google AI Studio API Connector",apiSub:"Add your Gemini API key.",apiKey:"Gemini API Key",show:"Show",hide:"Hide",testKey:"Test API",
    keyNote:"The key stays in this browser tab's memory and is sent with each request. Never upload it to GitHub."
  }
};
let lang = "hi";
function setTextLanguage() {
  lang = $("language").value;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const value = words[lang][el.dataset.i18n];
    if (value) el.textContent = value;
  });
}
$("language").addEventListener("change", setTextLanguage);
document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
  $("uploadPane").hidden = btn.dataset.tab !== "upload";
  $("youtubePane").hidden = btn.dataset.tab !== "youtube";
}));
$("videoFile").addEventListener("change", e => {
  selectedFile = e.target.files[0] || null;
  $("fileName").textContent = selectedFile ? `${selectedFile.name} · ${(selectedFile.size/1048576).toFixed(1)} MB` : "अभी कोई वीडियो नहीं चुना गया।";
  if (selectedFile) {
    $("localPreview").src = URL.createObjectURL(selectedFile);
    $("localPreview").hidden = false;
  } else $("localPreview").hidden = true;
});
function videoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0];
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/");
      if (["embed","shorts","live"].includes(parts[1])) return parts[2];
    }
  } catch {}
  return null;
}
$("previewBtn").addEventListener("click", () => {
  const id = videoId($("youtubeUrl").value.trim());
  $("ytPreview").innerHTML = "";
  if (!id) { $("ytPreview").textContent = "Valid YouTube URL डालें।"; return; }
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`;
  iframe.title = "YouTube video preview"; iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"; iframe.allowFullscreen = true;
  $("ytPreview").append(iframe);
});
$("toggleKey").addEventListener("click", () => {
  const input = $("apiKey");
  input.type = input.type === "password" ? "text" : "password";
  $("toggleKey").textContent = input.type === "password" ? words[lang].show : words[lang].hide;
});
$("apiKey").addEventListener("input", e => { apiKey = e.target.value.trim(); });
function headers() { return apiKey ? {"x-gemini-api-key": apiKey} : {}; }
function status(id, message, error=false) { $(id).textContent = message; $(id).classList.toggle("error", error); }
async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
$("testKey").addEventListener("click", async () => {
  if (!apiKey) return status("keyStatus", "पहले API Key डालें।", true);
  try {
    const r = await jsonFetch("/api/health");
    // A low-cost real validation is performed by asking for a tiny Gemini response through the analyze/dub endpoint only.
    status("keyStatus", r.ok ? "Server तैयार है। API Key अगली AI कार्रवाई में verify होगी।" : "Server उपलब्ध नहीं है।");
  } catch (e) { status("keyStatus", e.message, true); }
});
$("analyzeBtn").addEventListener("click", async () => {
  if (!selectedFile) return status("analysisStatus", "पहले MP4 वीडियो अपलोड करें। YouTube preview से clip export नहीं किया जा सकता।", true);
  const fd = new FormData(); fd.append("video", selectedFile);
  $("analyzeBtn").disabled = true; status("analysisStatus", "Gemini वीडियो पढ़ रहा है। इसमें कुछ समय लग सकता है...");
  try {
    analysis = await jsonFetch("/api/analyze", {method:"POST", headers:headers(), body:fd});
    $("analysisResult").hidden = false;
    $("summaryText").textContent = analysis.summary || "";
    $("transcript").value = analysis.transcript || "";
    $("dubText").value = analysis.transcript || "";
    $("clipList").innerHTML = "";
    (analysis.clips || []).forEach((clip, i) => {
      const card = document.createElement("div"); card.className = "clip-card";
      const title = document.createElement("b"); title.textContent = `${i+1}. ${clip.title || "Suggested clip"} (${clip.start}s–${clip.end}s)`;
      const why = document.createElement("p"); why.textContent = clip.reason || "";
      const use = document.createElement("button"); use.className = "secondary"; use.textContent = "Use this time range";
      use.addEventListener("click", () => { $("clipStart").value = clip.start; $("clipEnd").value = clip.end; window.scrollTo({top:$("clipStart").getBoundingClientRect().top + window.scrollY - 120,behavior:"smooth"}); });
      card.append(title, why, use); $("clipList").append(card);
    });
    status("analysisStatus", "Analysis complete.");
  } catch (e) { status("analysisStatus", e.message, true); }
  finally { $("analyzeBtn").disabled = false; }
});
function timeSrt(seconds) {
  const ms = Math.max(0, Math.round(seconds*1000));
  const h = String(Math.floor(ms/3600000)).padStart(2,"0");
  const m = String(Math.floor(ms%3600000/60000)).padStart(2,"0");
  const s = String(Math.floor(ms%60000/1000)).padStart(2,"0");
  const milli = String(ms%1000).padStart(3,"0");
  return `${h}:${m}:${s},${milli}`;
}
$("downloadSrt").addEventListener("click", () => {
  if (!analysis?.captions?.length) return status("analysisStatus", "No caption segments available.", true);
  const srt = analysis.captions.map((c,i)=>`${i+1}\n${timeSrt(c.start)} --> ${timeSrt(c.end)}\n${c.text}`).join("\n\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([srt],{type:"text/plain;charset=utf-8"})); a.download="captions.srt"; a.click(); URL.revokeObjectURL(a.href);
});
$("clipBtn").addEventListener("click", async () => {
  if (!selectedFile) return status("clipStatus", "क्लिप बनाने के लिए पहले MP4 अपलोड करें।", true);
  const fd = new FormData(); fd.append("video", selectedFile); fd.append("start", $("clipStart").value); fd.append("end", $("clipEnd").value);
  $("clipBtn").disabled = true; status("clipStatus", "MP4 clip बनाया जा रहा है...");
  try {
    const result = await jsonFetch("/api/clip", {method:"POST", headers:headers(), body:fd});
    $("clipDownload").innerHTML = `<a class="result-link" href="${result.url}" download="${result.filename}">⬇ Download ${result.filename}</a>`;
    status("clipStatus", "Clip export हो गया।");
  } catch(e) { status("clipStatus", e.message, true); }
  finally { $("clipBtn").disabled = false; }
});
$("dubBtn").addEventListener("click", async () => {
  const text = $("dubText").value.trim();
  if (!text) return status("dubStatus", "पहले transcript या dubbing script डालें।", true);
  const fd = new FormData(); fd.append("text", text); fd.append("targetLanguage", $("targetLanguage").value);
  if (selectedFile) fd.append("video", selectedFile);
  $("dubBtn").disabled = true; status("dubStatus", "AI script translate और voice generate कर रहा है...");
  try {
    const result = await jsonFetch("/api/dub", {method:"POST", headers:headers(), body:fd});
    $("dubResult").innerHTML = "";
    const script = document.createElement("p"); script.textContent = result.script;
    const audio = document.createElement("audio"); audio.controls = true; audio.src = result.audioUrl; audio.style.width="100%";
    $("dubResult").append(script,audio);
    const link = document.createElement("a"); link.className="result-link"; link.href=result.audioUrl; link.download="ai-dubbing.wav"; link.textContent="⬇ Download WAV audio"; $("dubResult").append(link);
    if (result.videoUrl) { const v = document.createElement("a"); v.className="result-link"; v.href=result.videoUrl; v.download="dubbed-video.mp4"; v.textContent="⬇ Download dubbed MP4"; $("dubResult").append(v); }
    status("dubStatus", "Dubbing तैयार है।");
  } catch(e) { status("dubStatus", e.message, true); }
  finally { $("dubBtn").disabled = false; }
});
setTextLanguage();
