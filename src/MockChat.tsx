import { useEffect, useRef, useState, type FormEvent } from "react";

const topics = [
  {
    question: "ตั้งเวลาให้อาหารอย่างไร?",
    match: /ตาราง|ตั้งเวลา|มื้อ|schedul/i,
    answer: "เปิดแท็บ Schedule แล้วเพิ่มเวลาให้อาหาร เลือกเวลาและปริมาณต่อมื้อ จากนั้นบันทึกตารางได้เลยครับ",
  },
  {
    question: "ดูอาหารคงเหลือตรงไหน?",
    match: /คงเหลือ|เหลือ|หมด|เติมอาหาร|food level|refill/i,
    answer: "เปิดแท็บ Monitor เพื่อดูระดับอาหารในเครื่อง ถ้าอาหารใกล้หมด ให้เติมอาหารเม็ดลงในถังครับ",
  },
  {
    question: "เครื่องให้อาหารออฟไลน์ทำอย่างไร?",
    match: /ออฟไลน์|เชื่อมต่อ|ไวไฟ|offline|wi-?fi/i,
    answer: "ลองตรวจสอบว่าเครื่องให้อาหารเปิดอยู่และเชื่อมต่อ Wi-Fi แล้ว จากนั้นเปิดหน้า Home เพื่อดูสถานะเครื่องอีกครั้งครับ",
  },
  {
    question: "ดูประวัติการให้อาหารที่ไหน?",
    match: /ประวัติ|ครั้งล่าสุด|history/i,
    answer: "เปิดแท็บ History เพื่อดูรายการให้อาหารที่ผ่านมาได้ครับ",
  },
];

type Message = { role: "assistant" | "user"; text: string };

export default function MockChat({ aboveNavigation }: { aboveNavigation: boolean }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "สวัสดีครับ! ถามผมเรื่องตารางให้อาหาร ระดับอาหาร หรือการเชื่อมต่อเครื่อง PawSync ได้เลยครับ" },
  ]);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) closeButton.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open]);

  function closeChat() {
    setOpen(false);
    launcher.current?.focus();
  }

  function sendMessage(value: string) {
    const text = value.trim();
    if (!text) return;

    const reply = topics.find((topic) => topic.match.test(text))?.answer ??
      "ตอนนี้ผมตอบคำถามเกี่ยวกับตารางให้อาหาร ระดับอาหาร การเชื่อมต่อ และประวัติการให้อาหารได้ครับ ลองถามว่า “ดูอาหารคงเหลือตรงไหน?”";

    setMessages((previous) => [...previous, { role: "user", text }, { role: "assistant", text: reply }]);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendMessage(draft);
    setDraft("");
  }

  return (
    <div className={`mock-chat ${aboveNavigation ? "mock-chat-above-nav" : ""}`} lang="th">
      {open && (
        <section
          id="pawsync-chat"
          role="dialog"
          aria-labelledby="pawsync-chat-title"
          className="mock-chat-panel flex flex-col overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl"
          onKeyDown={(event) => {
            if (event.key === "Escape") closeChat();
          }}
        >
          <header className="flex shrink-0 items-center justify-between gap-3 bg-blue-50 px-4 py-3">
            <div>
              <h2 id="pawsync-chat-title" className="font-bold">PawSync AI</h2>
              <p className="text-xs text-slate-600">แชทจำลอง</p>
            </div>
            <button ref={closeButton} type="button" onClick={closeChat} aria-label="ปิดแชท" className="grid size-10 cursor-pointer place-items-center rounded-full text-2xl text-slate-700 hover:bg-blue-100">
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div ref={log} role="log" aria-label="ข้อความแชท" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
            {messages.map((message, index) => (
              <p key={index} className={`w-fit max-w-[90%] rounded-2xl px-3 py-2 text-sm leading-relaxed wrap-anywhere ${message.role === "user" ? "ml-auto rounded-br-sm bg-blue-700 text-white" : "rounded-bl-sm bg-blue-50 text-slate-800"}`}>
                <span className="sr-only">{message.role === "user" ? "คุณ: " : "PawSync AI: "}</span>
                {message.text}
              </p>
            ))}
          </div>
          <div className="flex shrink-0 gap-2 overflow-x-auto px-4 pb-3">
            {topics.map(({ question }) => (
              <button key={question} type="button" onClick={() => sendMessage(question)} className="shrink-0 cursor-pointer rounded-full border border-blue-200 px-3 py-2 text-xs font-medium text-blue-800 hover:bg-blue-50">
                {question}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-blue-100 p-3">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={500} aria-label="ข้อความ" placeholder="พิมพ์ข้อความ…" className="min-w-0 flex-1 rounded-xl bg-slate-100 px-3 text-base" />
            <button type="submit" disabled={!draft.trim()} className="min-h-11 cursor-pointer rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-default disabled:opacity-50">ส่ง</button>
          </form>
        </section>
      )}
      <button
        ref={launcher}
        type="button"
        aria-label={open ? "ย่อแชท AI" : "เปิดแชท AI"}
        aria-expanded={open}
        aria-controls={open ? "pawsync-chat" : undefined}
        onClick={() => open ? closeChat() : setOpen(true)}
        className="mock-chat-launcher flex h-12 cursor-pointer items-center gap-2 rounded-full bg-blue-700 px-4 text-sm font-bold text-white shadow-lg hover:bg-blue-800"
      >
        <span aria-hidden="true">✦</span> แชท AI
      </button>
    </div>
  );
}
