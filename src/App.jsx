import { useState, useEffect } from "react";
import { supabase } from "./supabase";

const VERSION = "v1.6.0";
const today = () => new Date().toISOString().split("T")[0];
const CATEGORIES = ["카메라", "렌즈", "마이크", "삼각대", "조명", "특수장비", "기타"];

const RENTAL_STATUS = {
  pending:   { label: "승인 대기", bg: "#faeeda", color: "#854F0B" },
  approved:  { label: "대여 중",   bg: "#faece7", color: "#993C1D" },
  returned:  { label: "반납 완료", bg: "#eaf3de", color: "#3B6D11" },
  rejected:  { label: "반려됨",    bg: "#fcebeb", color: "#A32D2D" },
  cancelled: { label: "취소됨",    bg: "#f1efe8", color: "#5F5E5A" },
};

function datesOverlap(s1, e1, s2, e2) {
  return s1 <= e2 && e1 >= s2;
}

function qtyOverlapping(rentals, equipId, statuses, startDate, endDate) {
  return rentals
    .filter(r => {
      if (!statuses.includes(r.status)) return false;
      if (!r.items || !r.items.some(i => i.equipmentId === equipId)) return false;
      if (startDate && endDate) return datesOverlap(r.start_date, r.end_date, startDate, endDate);
      return true;
    })
    .reduce((sum, r) => {
      const item = r.items.find(i => i.equipmentId === equipId);
      return sum + (item ? item.qty : 0);
    }, 0);
}

function availableQty(equipment, rentals, equipId, startDate, endDate) {
  const eq = equipment.find(e => e.id === equipId);
  if (!eq) return 0;
  return eq.quantity - qtyOverlapping(rentals, equipId, ["approved", "pending"], startDate, endDate);
}

function qtyByStatus(rentals, equipId, statuses) {
  return rentals
    .filter(r => statuses.includes(r.status) && r.items && r.items.some(i => i.equipmentId === equipId))
    .reduce((sum, r) => {
      const item = r.items.find(i => i.equipmentId === equipId);
      return sum + (item ? item.qty : 0);
    }, 0);
}

// 모달 공통 래퍼
function ModalWrap({ onClose, children }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }} onClick={onClose}>
      <div style={{ background: "#fff", border: "0.5px solid #ccc", borderRadius: 12, padding: "24px 28px", maxWidth: 360, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ActionModal({ actionModal, onClose, onConfirm, s }) {
  const [memo, setMemo] = useState("");
  if (!actionModal) return null;
  const isApprove = actionModal.type === "approve";
  return (
    <ModalWrap onClose={onClose}>
      <p style={{ fontWeight: 500, fontSize: 16, marginBottom: 6 }}>{isApprove ? "대여 승인" : "대여 반려"}</p>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 14 }}>메모를 남기면 대여자에게도 표시됩니다.</p>
      <div style={{ marginBottom: 20 }}>
        <label style={s.label}>메모 (선택)</label>
        <textarea
          style={{ ...s.input, resize: "vertical", minHeight: 80, fontFamily: "sans-serif" }}
          placeholder={isApprove ? "예) 배터리 2개 포함, 렌즈 캡 없음 확인" : "예) 해당 기간 이미 예약됨"}
          value={memo}
          onChange={e => setMemo(e.target.value)}
          autoFocus
        />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onClose}>취소</button>
        <button
          style={isApprove ? s.btnPrimary : { ...s.btnDanger, padding: "8px 16px", border: "none", background: "#A32D2D", color: "#fff" }}
          onClick={() => onConfirm(memo)}
        >{isApprove ? "승인" : "반려"}</button>
      </div>
    </ModalWrap>
  );
}

function PwModal({ onClose, onConfirm, currentPassword, s }) {
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const handle = () => {
    setPwError("");
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) return setPwError("모든 항목을 입력해주세요.");
    if (pwForm.current !== currentPassword) return setPwError("현재 비밀번호가 올바르지 않습니다.");
    if (pwForm.next.length < 4) return setPwError("새 비밀번호는 4자 이상이어야 합니다.");
    if (pwForm.next !== pwForm.confirm) return setPwError("새 비밀번호가 일치하지 않습니다.");
    onConfirm(pwForm.next);
  };
  return (
    <ModalWrap onClose={onClose}>
      <p style={{ fontWeight: 500, fontSize: 16, marginBottom: 16 }}>비밀번호 변경</p>
      {pwError && <div style={{ ...s.alert("error"), marginBottom: 12 }}>{pwError}</div>}
      <div style={{ marginBottom: 12 }}><label style={s.label}>현재 비밀번호</label><input style={s.input} type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} /></div>
      <div style={{ marginBottom: 12 }}><label style={s.label}>새 비밀번호</label><input style={s.input} type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} /></div>
      <div style={{ marginBottom: 20 }}><label style={s.label}>새 비밀번호 확인</label><input style={s.input} type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} onKeyDown={e => e.key === "Enter" && handle()} /></div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onClose}>취소</button>
        <button style={s.btnPrimary} onClick={handle}>변경</button>
      </div>
    </ModalWrap>
  );
}

function DeleteModal({ eq, onClose, onConfirm, s }) {
  if (!eq) return null;
  return (
    <ModalWrap onClose={onClose}>
      <p style={{ fontWeight: 500, fontSize: 16, marginBottom: 8 }}>장비 삭제</p>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
        <strong style={{ color: "#111" }}>{eq.name}</strong>을(를) 삭제하시겠습니까?<br />이 작업은 되돌릴 수 없습니다.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button style={s.btn} onClick={onClose}>취소</button>
        <button style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#A32D2D", color: "#fff", cursor: "pointer", fontSize: 14 }} onClick={onConfirm}>삭제</button>
      </div>
    </ModalWrap>
  );
}

function RentalCard({ r, s, onOpenAction, onReturn, onCancel, isHistory, isUser }) {
  const st = RENTAL_STATUS[r.status] || { label: r.status, bg: "#f1efe8", color: "#444" };
  return (
    <div style={{ ...s.card, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
            <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 99, fontSize: 12, fontWeight: 500, background: st.bg, color: st.color }}>{st.label}</span>
            <span style={{ fontSize: 13, color: "#666" }}>{r.user_name}{r.user_department ? " (" + r.user_department + ")" : ""} · {r.user_phone}</span>
            <span style={{ fontSize: 13, color: "#666" }}>신청: {r.created_at ? new Date(r.created_at).toLocaleString("ko-KR") : ""}</span>
          </div>
          <div style={{ marginBottom: 6 }}>
            {r.items && r.items.map(i => (
              <span key={i.equipmentId} style={{ display: "inline-block", fontSize: 13, background: "#f5f5f5", borderRadius: 4, padding: "2px 8px", marginRight: 6, marginBottom: 4 }}>{i.equipmentName} {i.qty}대</span>
            ))}
          </div>
          <div style={{ fontSize: 13, color: "#666" }}>
            <span>대여: {r.start_date} ~ {r.end_date}</span>
            {r.note && <span style={{ marginLeft: 12 }}>신청 메모: {r.note}</span>}
            {r.returned_at && <span style={{ marginLeft: 12 }}>반납: {r.returned_at}</span>}
          </div>
          {r.admin_memo && (
            <div style={{ marginTop: 8, padding: "7px 12px", borderRadius: 8, background: "#f5f5f5", fontSize: 13 }}>
              <span style={{ color: "#666", marginRight: 6 }}>관리자 메모:</span>
              <span>{r.admin_memo}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {isUser && r.status === "pending" && <button style={s.btnDanger} onClick={() => onCancel(r.id)}>신청 취소</button>}
          {!isUser && !isHistory && r.status === "pending" && (
            <>
              <button style={s.btnSuccess} onClick={() => onOpenAction("approve", r.id)}>승인</button>
              <button style={s.btnDanger} onClick={() => onOpenAction("reject", r.id)}>반려</button>
            </>
          )}
          {!isUser && !isHistory && r.status === "approved" && (
            <button style={s.btnPrimary} onClick={() => onReturn(r.id)}>반납 확인</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("login");
  const [equipment, setEquipment] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const [loginForm, setLoginForm] = useState({ phone: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", department: "", phone: "", password: "" });
  const [authTab, setAuthTab] = useState("login");
  const [adminTab, setAdminTab] = useState("equipment");
  const [userTab, setUserTab] = useState("equipment");
  const [newEquip, setNewEquip] = useState({ name: "", category: "카메라", description: "", quantity: 1 });
  const [editEquipId, setEditEquipId] = useState(null);
  const [editEquipForm, setEditEquipForm] = useState({});
  const [adminCatFilter, setAdminCatFilter] = useState("전체");
  const [userCatFilter, setUserCatFilter] = useState("전체");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDeleteEq, setConfirmDeleteEq] = useState(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [cart, setCart] = useState({});
  const [rentalDates, setRentalDates] = useState({ start: "", end: "" });
  const [rentalNote, setRentalNote] = useState("");
  const [noticeEdit, setNoticeEdit] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState("");

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(""), 2800); return () => clearTimeout(t); }
  }, [success]);

  async function fetchAll() {
    setLoading(true);
    const [{ data: eq }, { data: re }, { data: se }] = await Promise.all([
      supabase.from("equipment").select("*"),
      supabase.from("rentals").select("*").order("id", { ascending: false }),
      supabase.from("settings").select("*"),
    ]);
    const orderSetting = se && se.find(s => s.key === "equipment_order");
    let orderedEq = eq || [];
    if (orderSetting) {
      try {
        const order = JSON.parse(orderSetting.value);
        orderedEq = [...orderedEq].sort((a, b) => {
          const ai = order.indexOf(a.id);
          const bi = order.indexOf(b.id);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
      } catch {}
    }
    setEquipment(orderedEq);
    setRentals(re || []);
    const n = se && se.find(s => s.key === "notice");
    setNotice(n ? n.value : "");
    setLoading(false);
  }

  async function handleLogin() {
    setError("");
    const { data, error } = await supabase.from("users").select("*").eq("phone", loginForm.phone).eq("password", loginForm.password).single();
    if (error || !data) return setError("전화번호 또는 비밀번호가 올바르지 않습니다.");
    setCurrentUser(data);
    setPage(data.role === "admin" ? "admin" : "user");
  }

  async function handleRegister() {
    setError("");
    if (!registerForm.name || !registerForm.department || !registerForm.phone || !registerForm.password)
      return setError("모든 항목을 입력해주세요.");
    const { data: exist } = await supabase.from("users").select("id").eq("phone", registerForm.phone).single();
    if (exist) return setError("이미 등록된 전화번호입니다.");
    const { error } = await supabase.from("users").insert([{ ...registerForm, role: "user" }]);
    if (error) return setError("가입 중 오류가 발생했습니다.");
    setSuccess("회원가입 완료! 로그인해주세요.");
    setAuthTab("login");
    setLoginForm({ phone: registerForm.phone, password: registerForm.password });
    setRegisterForm({ name: "", department: "", phone: "", password: "" });
  }

  async function handleSaveNotice() {
    await supabase.from("settings").upsert([{ key: "notice", value: noticeDraft }], { onConflict: "key" });
    setNotice(noticeDraft);
    setNoticeEdit(false);
    setSuccess("공지가 저장되었습니다.");
  }

  async function handleAddEquipment() {
    if (!newEquip.name || !newEquip.category) return setError("장비명과 카테고리를 입력해주세요.");
    if (newEquip.quantity < 1) return setError("수량은 1 이상이어야 합니다.");
    const { error } = await supabase.from("equipment").insert([{ ...newEquip, quantity: Number(newEquip.quantity) }]);
    if (error) return setError("장비 추가 중 오류가 발생했습니다.");
    setNewEquip({ name: "", category: "카메라", description: "", quantity: 1 });
    setSuccess("장비가 추가되었습니다."); setError("");
    await fetchAll();
  }

  async function handleDeleteEquipment(id) {
    const inUse = qtyByStatus(rentals, id, ["approved", "pending"]) > 0;
    if (inUse) { setError("현재 대여 중이거나 승인 대기 중인 장비는 삭제할 수 없습니다."); setConfirmDeleteEq(null); return; }
    await supabase.from("equipment").delete().eq("id", id);
    setSuccess("장비가 삭제되었습니다."); setConfirmDeleteEq(null);
    await fetchAll();
  }

  async function handleUpdateQty(id, qty) {
    const n = Number(qty);
    const minQty = qtyByStatus(rentals, id, ["approved", "pending"]);
    if (n < minQty) return setError("현재 대여/대기 수량(" + minQty + "대)보다 낮게 설정할 수 없습니다.");
    if (n < 1) return;
    await supabase.from("equipment").update({ quantity: n }).eq("id", id);
    setError(""); await fetchAll();
  }

  async function handleUpdateEquip(id) {
    if (!editEquipForm.name || !editEquipForm.category) return setError("장비명과 카테고리를 입력해주세요.");
    await supabase.from("equipment").update({
      name: editEquipForm.name,
      category: editEquipForm.category,
      description: editEquipForm.description,
    }).eq("id", id);
    setEditEquipId(null);
    setSuccess("장비 정보가 수정되었습니다.");
    await fetchAll();
  }

  async function handleMoveEquip(index, direction) {
    const newList = [...equipment];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newList.length) return;
    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    const order = newList.map(e => e.id);
    await supabase.from("settings").upsert([{ key: "equipment_order", value: JSON.stringify(order) }], { onConflict: "key" });
    setEquipment(newList);
  }

  const cartItems = Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => {
    const eq = equipment.find(e => e.id === Number(id));
    return { equipmentId: Number(id), equipmentName: eq ? eq.name : "", qty };
  });

  async function handleRentalRequest() {
    setError("");
    if (cartItems.length === 0) return setError("신청할 장비를 선택해주세요.");
    if (!rentalDates.start || !rentalDates.end) return setError("대여 시작일과 반납 예정일을 입력해주세요.");
    if (rentalDates.end < rentalDates.start) return setError("반납 예정일은 시작일 이후여야 합니다.");
    for (const item of cartItems) {
      const avail = availableQty(equipment, rentals, item.equipmentId, rentalDates.start, rentalDates.end);
      if (item.qty > avail) return setError(item.equipmentName + " 해당 기간 가용 수량(" + avail + "대)을 초과했습니다.");
    }
    const { error } = await supabase.from("rentals").insert([{
      user_id: currentUser.id,
      user_name: currentUser.name,
      user_department: currentUser.department,
      user_phone: currentUser.phone,
      items: cartItems,
      start_date: rentalDates.start,
      end_date: rentalDates.end,
      note: rentalNote,
      status: "pending",
    }]);
    if (error) return setError("신청 중 오류가 발생했습니다.");
    setCart({}); setRentalNote(""); setRentalDates({ start: "", end: "" });
    setSuccess("대여 신청이 완료되었습니다.");
    setUserTab("myrentals");
    await fetchAll();
  }

  async function handleAction(memo) {
    if (!actionModal) return;
    const { type, rentalId } = actionModal;
    const newStatus = type === "approve" ? "approved" : "rejected";
    await supabase.from("rentals").update({ status: newStatus, admin_memo: memo }).eq("id", rentalId);
    setSuccess(type === "approve" ? "승인되었습니다." : "반려되었습니다.");
    setActionModal(null);
    await fetchAll();
  }

  async function handleReturn(id) {
    await supabase.from("rentals").update({ status: "returned", returned_at: new Date().toLocaleString("ko-KR") }).eq("id", id);
    setSuccess("반납이 확인되었습니다.");
    await fetchAll();
  }

  async function handleCancel(id) {
    await supabase.from("rentals").update({ status: "cancelled" }).eq("id", id);
    setSuccess("대여 신청이 취소되었습니다.");
    await fetchAll();
  }

  async function handleChangePw(newPw) {
    await supabase.from("users").update({ password: newPw }).eq("id", currentUser.id);
    setCurrentUser(prev => ({ ...prev, password: newPw }));
    setShowPwModal(false);
    setSuccess("비밀번호가 변경되었습니다.");
  }

  const myRentals = currentUser ? rentals.filter(r => r.user_id === currentUser.id) : [];

  const s = {
    wrap: { fontFamily: "sans-serif", maxWidth: 800, margin: "0 auto", padding: "24px 16px", color: "#111" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 16, borderBottom: "0.5px solid #ddd" },
    title: { fontSize: 20, fontWeight: 500, margin: 0 },
    btn: { padding: "8px 16px", borderRadius: 8, border: "0.5px solid #ccc", background: "transparent", cursor: "pointer", fontSize: 14, color: "#111" },
    btnPrimary: { padding: "8px 16px", borderRadius: 8, border: "none", background: "#185FA5", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 500 },
    btnSm: { padding: "5px 12px", borderRadius: 8, border: "0.5px solid #ccc", background: "transparent", cursor: "pointer", fontSize: 13, color: "#111" },
    btnDanger: { padding: "5px 12px", borderRadius: 8, border: "0.5px solid #F09595", background: "transparent", cursor: "pointer", fontSize: 13, color: "#A32D2D" },
    btnSuccess: { padding: "5px 12px", borderRadius: 8, border: "0.5px solid #97C459", background: "transparent", cursor: "pointer", fontSize: 13, color: "#3B6D11" },
    card: { background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "14px 18px", marginBottom: 10 },
    input: { width: "100%", padding: "8px 12px", borderRadius: 8, border: "0.5px solid #ccc", background: "#fff", color: "#111", fontSize: 14, boxSizing: "border-box" },
    label: { fontSize: 12, color: "#666", marginBottom: 5, display: "block" },
    tabs: { display: "flex", gap: 0, marginBottom: 20, borderBottom: "0.5px solid #ddd" },
    tab: (a) => ({ padding: "8px 18px", background: "transparent", border: "none", borderBottom: a ? "2px solid #185FA5" : "2px solid transparent", cursor: "pointer", fontSize: 14, fontWeight: a ? 500 : 400, color: a ? "#185FA5" : "#666", marginBottom: -1 }),
    row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
    alert: (t) => ({ padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 14, background: t === "error" ? "#fcebeb" : "#eaf3de", color: t === "error" ? "#A32D2D" : "#3B6D11", border: "0.5px solid " + (t === "error" ? "#F09595" : "#97C459") }),
    statCard: { background: "#f5f5f5", borderRadius: 8, padding: "14px 16px" },
    statNum: { fontSize: 26, fontWeight: 500, margin: 0 },
    statLbl: { fontSize: 12, color: "#666", marginTop: 4 },
    qtyBadge: (avail, total) => ({ fontSize: 12, padding: "3px 10px", borderRadius: 99, fontWeight: 500, background: avail === 0 ? "#fcebeb" : avail < total ? "#faeeda" : "#eaf3de", color: avail === 0 ? "#A32D2D" : avail < total ? "#854F0B" : "#3B6D11" }),
    catFilter: (a) => ({ padding: "5px 12px", borderRadius: 99, border: a ? "none" : "0.5px solid #ccc", background: a ? "#185FA5" : "transparent", color: a ? "#fff" : "#666", cursor: "pointer", fontSize: 13, fontWeight: a ? 500 : 400 }),
    noticeBox: { marginBottom: 16, padding: "12px 18px", borderRadius: 12, border: "0.5px solid #ddd", background: "#f5f5f5" },
  };

  if (loading) return <div style={{ textAlign: "center", paddingTop: 80, color: "#666", fontFamily: "sans-serif" }}>불러오는 중...</div>;

  // 로그인
  if (page === "login") return (
    <div style={s.wrap}>
      <div style={{ maxWidth: 400, margin: "40px auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 500, textAlign: "center", marginBottom: 4 }}>JTBC 보도국 장비대여 시스템</h1>
        <p style={{ textAlign: "center", fontSize: 12, color: "#aaa", marginBottom: 28 }}>{VERSION}</p>
        <div style={s.tabs}>
          <button style={s.tab(authTab === "login")} onClick={() => { setAuthTab("login"); setError(""); }}>로그인</button>
          <button style={s.tab(authTab === "register")} onClick={() => { setAuthTab("register"); setError(""); }}>회원가입</button>
        </div>
        {error && <div style={s.alert("error")}>{error}</div>}
        {success && <div style={s.alert("success")}>{success}</div>}
        {authTab === "login" ? (
          <div>
            <div style={{ marginBottom: 14 }}><label style={s.label}>전화번호</label><input style={s.input} placeholder="010-0000-0000" value={loginForm.phone} onChange={e => setLoginForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div style={{ marginBottom: 20 }}><label style={s.label}>비밀번호</label><input style={s.input} type="password" value={loginForm.password} onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleLogin()} /></div>
            <button style={{ ...s.btnPrimary, width: "100%", padding: "10px" }} onClick={handleLogin}>로그인</button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 14 }}><label style={s.label}>이름</label><input style={s.input} placeholder="홍길동" value={registerForm.name} onChange={e => setRegisterForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div style={{ marginBottom: 14 }}><label style={s.label}>부서</label><input style={s.input} placeholder="예) 마케팅팀" value={registerForm.department} onChange={e => setRegisterForm(p => ({ ...p, department: e.target.value }))} /></div>
            <div style={{ marginBottom: 14 }}><label style={s.label}>전화번호</label><input style={s.input} placeholder="010-0000-0000" value={registerForm.phone} onChange={e => setRegisterForm(p => ({ ...p, phone: e.target.value }))} /></div>
            <div style={{ marginBottom: 20 }}><label style={s.label}>비밀번호</label><input style={s.input} type="password" value={registerForm.password} onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleRegister()} /></div>
            <button style={{ ...s.btnPrimary, width: "100%", padding: "10px" }} onClick={handleRegister}>회원가입</button>
          </div>
        )}
        {notice ? (
          <div style={{ ...s.noticeBox, marginTop: 32 }}>
            <p style={{ fontSize: 12, color: "#666", marginBottom: 6, marginTop: 0 }}>공지</p>
            <p style={{ fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>{notice}</p>
          </div>
        ) : null}
      </div>
    </div>
  );

  // 관리자
  if (page === "admin") {
    const pending = rentals.filter(r => r.status === "pending");
    const active  = rentals.filter(r => r.status === "approved");
    const totalAvail = equipment.reduce((sum, eq) => sum + availableQty(equipment, rentals, eq.id, null, null), 0);
    const filteredEquip = equipment.filter(eq => adminCatFilter === "전체" || eq.category === adminCatFilter);

    return (
      <div style={s.wrap}>
        {confirmDeleteEq && <DeleteModal eq={equipment.find(e => e.id === confirmDeleteEq)} onClose={() => setConfirmDeleteEq(null)} onConfirm={() => handleDeleteEquipment(confirmDeleteEq)} s={s} />}
        {actionModal && <ActionModal actionModal={actionModal} onClose={() => setActionModal(null)} onConfirm={handleAction} s={s} />}
        {showPwModal && <PwModal currentPassword={currentUser.password} onClose={() => setShowPwModal(false)} onConfirm={handleChangePw} s={s} />}

        <div style={s.header}>
          <div>
            <h1 style={s.title}>JTBC 보도국 장비대여 시스템</h1>
            <span style={{ fontSize: 13, color: "#666" }}>관리자 · {currentUser.name}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.btn} onClick={() => setShowPwModal(true)}>비밀번호 변경</button>
            <button style={s.btn} onClick={() => { setCurrentUser(null); setPage("login"); }}>로그아웃</button>
          </div>
        </div>
        {success && <div style={s.alert("success")}>{success}</div>}
        {error && <div style={s.alert("error")}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 22 }}>
          <div style={s.statCard}><p style={s.statNum}>{equipment.length}</p><p style={s.statLbl}>장비 종류</p></div>
          <div style={s.statCard}><p style={s.statNum}>{equipment.reduce((s, e) => s + e.quantity, 0)}</p><p style={s.statLbl}>전체 수량</p></div>
          <div style={s.statCard}><p style={s.statNum}>{totalAvail}</p><p style={s.statLbl}>현재 가용</p></div>
          <div style={s.statCard}><p style={s.statNum}>{pending.length}</p><p style={s.statLbl}>승인 대기</p></div>
          <div style={s.statCard}><p style={s.statNum}>{active.length}</p><p style={s.statLbl}>대여 중</p></div>
        </div>

        <div style={s.tabs}>
          <button style={s.tab(adminTab === "equipment")} onClick={() => setAdminTab("equipment")}>장비 관리</button>
          <button style={s.tab(adminTab === "rentals")} onClick={() => setAdminTab("rentals")}>
            대여 관리{pending.length > 0 && <span style={{ background: "#E24B4A", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 6px", marginLeft: 5 }}>{pending.length}</span>}
          </button>
          <button style={s.tab(adminTab === "history")} onClick={() => setAdminTab("history")}>대여 히스토리</button>
        </div>

        {adminTab === "equipment" && (
          <div>
            <div style={{ ...s.card, marginBottom: 12, borderColor: noticeEdit ? "#185FA5" : "#e0e0e0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontWeight: 500, fontSize: 14, margin: 0 }}>초기화면 공지</p>
                {noticeEdit ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={s.btn} onClick={() => setNoticeEdit(false)}>취소</button>
                    <button style={s.btnPrimary} onClick={handleSaveNotice}>저장</button>
                  </div>
                ) : (
                  <button style={s.btnSm} onClick={() => { setNoticeDraft(notice || ""); setNoticeEdit(true); }}>편집</button>
                )}
              </div>
              {noticeEdit ? (
                <textarea style={{ ...s.input, marginTop: 10, resize: "vertical", minHeight: 80, fontFamily: "sans-serif" }}
                  placeholder={"예) 담당자: 홍길동 / 직통: 010-1234-5678\n매주 금요일 오후 6시 이후 대여 불가"}
                  value={noticeDraft} onChange={e => setNoticeDraft(e.target.value)} />
              ) : (
                <p style={{ fontSize: 14, color: notice ? "#111" : "#aaa", whiteSpace: "pre-wrap", margin: "8px 0 0" }}>
                  {notice || "등록된 공지가 없습니다."}
                </p>
              )}
            </div>

            <div style={{ ...s.card, marginBottom: 20 }}>
              <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 12 }}>장비 추가</p>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 2fr 0.8fr auto", gap: 8, alignItems: "end" }}>
                <div><label style={s.label}>장비명</label><input style={s.input} placeholder="장비명" value={newEquip.name} onChange={e => setNewEquip(p => ({ ...p, name: e.target.value }))} /></div>
                <div><label style={s.label}>카테고리</label>
                  <select style={s.input} value={newEquip.category} onChange={e => setNewEquip(p => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label style={s.label}>설명 (선택)</label><input style={s.input} placeholder="설명" value={newEquip.description} onChange={e => setNewEquip(p => ({ ...p, description: e.target.value }))} /></div>
                <div><label style={s.label}>수량</label><input style={s.input} type="number" min="1" value={newEquip.quantity} onChange={e => setNewEquip(p => ({ ...p, quantity: e.target.value }))} /></div>
                <button style={{ ...s.btnPrimary, height: 37 }} onClick={handleAddEquipment}>추가</button>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {["전체", ...CATEGORIES].map(c => (
                <button key={c} style={s.catFilter(adminCatFilter === c)} onClick={() => setAdminCatFilter(c)}>{c}</button>
              ))}
            </div>

            {filteredEquip.map((eq, index) => {
              const avail  = availableQty(equipment, rentals, eq.id, null, null);
              const rented = qtyByStatus(rentals, eq.id, ["approved"]);
              const pend   = qtyByStatus(rentals, eq.id, ["pending"]);
              const inUse  = rented > 0 || pend > 0;
              const isEditing = editEquipId === eq.id;
              const realIndex = equipment.findIndex(e => e.id === eq.id);
              return (
                <div key={eq.id} style={{ ...s.card, marginBottom: 10 }}>
                  {isEditing ? (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 2fr", gap: 8, marginBottom: 10 }}>
                        <div><label style={s.label}>장비명</label><input style={s.input} value={editEquipForm.name} onChange={e => setEditEquipForm(p => ({ ...p, name: e.target.value }))} /></div>
                        <div><label style={s.label}>카테고리</label>
                          <select style={s.input} value={editEquipForm.category} onChange={e => setEditEquipForm(p => ({ ...p, category: e.target.value }))}>
                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div><label style={s.label}>설명</label><input style={s.input} value={editEquipForm.description} onChange={e => setEditEquipForm(p => ({ ...p, description: e.target.value }))} /></div>
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button style={s.btn} onClick={() => setEditEquipId(null)}>취소</button>
                        <button style={s.btnPrimary} onClick={() => handleUpdateEquip(eq.id)}>저장</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={s.row}>
                          <span style={{ fontWeight: 500 }}>{eq.name}</span>
                          <span style={{ fontSize: 12, color: "#666", background: "#f5f5f5", padding: "2px 8px", borderRadius: 4 }}>{eq.category}</span>
                          <span style={s.qtyBadge(avail, eq.quantity)}>현재 가용 {avail}/{eq.quantity}대</span>
                          {rented > 0 && <span style={{ fontSize: 12, color: "#993C1D" }}>대여 중 {rented}대</span>}
                          {pend > 0 && <span style={{ fontSize: 12, color: "#854F0B" }}>대기 {pend}대</span>}
                        </div>
                        {eq.description && <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>{eq.description}</p>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <button style={{ ...s.btnSm, padding: "2px 8px", fontSize: 11 }} onClick={() => handleMoveEquip(realIndex, "up")} disabled={realIndex === 0}>▲</button>
                          <button style={{ ...s.btnSm, padding: "2px 8px", fontSize: 11 }} onClick={() => handleMoveEquip(realIndex, "down")} disabled={realIndex === equipment.length - 1}>▼</button>
                        </div>
                        <button style={s.btnSm} onClick={() => { setEditEquipId(eq.id); setEditEquipForm({ name: eq.name, category: eq.category, description: eq.description || "" }); }}>편집</button>
                        <label style={{ fontSize: 12, color: "#666", whiteSpace: "nowrap" }}>수량</label>
                        <input style={{ ...s.input, width: 64 }} type="number" min="1" value={eq.quantity} onChange={e => handleUpdateQty(eq.id, e.target.value)} />
                        <button style={{ ...s.btnDanger, opacity: inUse ? 0.4 : 1, cursor: inUse ? "not-allowed" : "pointer" }} onClick={() => { if (!inUse) setConfirmDeleteEq(eq.id); }}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {adminTab === "rentals" && (
          <div>
            {[{ key: "pending", list: pending }, { key: "approved", list: active }].map(item => (
              <div key={item.key} style={{ marginBottom: 24 }}>
                <p style={{ fontWeight: 500, fontSize: 15, marginBottom: 10 }}>{RENTAL_STATUS[item.key].label} ({item.list.length})</p>
                {item.list.length === 0 && <p style={{ fontSize: 14, color: "#666" }}>없음</p>}
                {item.list.map(r => <RentalCard key={r.id} r={r} s={s} onOpenAction={(type, id) => setActionModal({ type, rentalId: id })} onReturn={handleReturn} />)}
              </div>
            ))}
          </div>
        )}

        {adminTab === "history" && (
          <div>
            <p style={{ fontWeight: 500, fontSize: 15, marginBottom: 12 }}>전체 대여 히스토리 ({rentals.length}건)</p>
            {rentals.length === 0 && <p style={{ fontSize: 14, color: "#666" }}>내역이 없습니다.</p>}
            {rentals.map(r => <RentalCard key={r.id} r={r} s={s} isHistory />)}
          </div>
        )}
      </div>
    );
  }

  // 대여자
  if (page === "user") {
    const activeCart = cartItems.length > 0;
    const activeRentals = myRentals.filter(r => r.status === "pending" || r.status === "approved").length;
    const startDate = rentalDates.start;
    const endDate = rentalDates.end;
    const datesSelected = startDate && endDate && endDate >= startDate;
    const filteredEquip = equipment.filter(eq => userCatFilter === "전체" || eq.category === userCatFilter);
    const currentlyRented = rentals.filter(r => r.status === "approved");

    return (
      <div style={s.wrap}>
        {showPwModal && <PwModal currentPassword={currentUser.password} onClose={() => setShowPwModal(false)} onConfirm={handleChangePw} s={s} />}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>JTBC 보도국 장비대여 시스템</h1>
            <span style={{ fontSize: 13, color: "#666" }}>{currentUser.name} ({currentUser.department})</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={s.btn} onClick={() => setShowPwModal(true)}>비밀번호 변경</button>
            <button style={s.btn} onClick={() => { setCurrentUser(null); setPage("login"); }}>로그아웃</button>
          </div>
        </div>
        {success && <div style={s.alert("success")}>{success}</div>}
        {error && <div style={s.alert("error")}>{error}</div>}

        <div style={s.tabs}>
          <button style={s.tab(userTab === "equipment")} onClick={() => setUserTab("equipment")}>
            장비 목록{activeCart ? <span style={{ background: "#185FA5", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 6px", marginLeft: 5 }}>{cartItems.length}</span> : null}
          </button>
          <button style={s.tab(userTab === "status")} onClick={() => setUserTab("status")}>
            대여 현황{currentlyRented.length > 0 ? <span style={{ background: "#993C1D", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 6px", marginLeft: 5 }}>{currentlyRented.length}</span> : null}
          </button>
          <button style={s.tab(userTab === "myrentals")} onClick={() => setUserTab("myrentals")}>
            내 대여 현황{activeRentals > 0 ? <span style={{ background: "#185FA5", color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 6px", marginLeft: 5 }}>{activeRentals}</span> : null}
          </button>
        </div>

        {userTab === "equipment" && (
          <div>
            {notice ? (
              <div style={s.noticeBox}>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 4, marginTop: 0 }}>공지</p>
                <p style={{ fontSize: 14, whiteSpace: "pre-wrap", margin: 0 }}>{notice}</p>
              </div>
            ) : null}
            <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: 12, border: datesSelected ? "1px solid #185FA5" : "0.5px solid #ccc", background: "#f1efe8" }}>
              <p style={{ fontWeight: 500, fontSize: 14, margin: "0 0 10px" }}>대여 기간 먼저 선택하세요</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={s.label}>대여 시작일</label><input style={s.input} type="date" value={startDate} min={today()} onChange={e => { setRentalDates(p => ({ ...p, start: e.target.value })); setCart({}); }} /></div>
                <div><label style={s.label}>반납 예정일</label><input style={s.input} type="date" value={endDate} min={startDate || today()} onChange={e => { setRentalDates(p => ({ ...p, end: e.target.value })); setCart({}); }} /></div>
              </div>
              {datesSelected && <p style={{ fontSize: 12, color: "#185FA5", margin: "8px 0 0" }}>선택 기간 기준으로 대여 가능 수량이 표시됩니다.</p>}
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
              {["전체", ...CATEGORIES].map(c => (
                <button key={c} style={s.catFilter(userCatFilter === c)} onClick={() => setUserCatFilter(c)}>{c}</button>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              {filteredEquip.map(eq => {
                const avail = datesSelected
                  ? availableQty(equipment, rentals, eq.id, startDate, endDate)
                  : availableQty(equipment, rentals, eq.id, null, null);
                const cartQty = cart[eq.id] || 0;
                return (
                  <div key={eq.id} style={s.card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={s.row}>
                          <span style={{ fontWeight: 500 }}>{eq.name}</span>
                          <span style={{ fontSize: 12, color: "#666", background: "#f5f5f5", padding: "2px 8px", borderRadius: 4 }}>{eq.category}</span>
                          <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 99, fontWeight: 500, background: avail === 0 ? "#fcebeb" : "#eaf3de", color: avail === 0 ? "#A32D2D" : "#3B6D11" }}>
                            {avail === 0 ? "대여 불가" : "대여 가능 " + avail + "대"}
                          </span>
                          {!datesSelected && <span style={{ fontSize: 12, color: "#aaa" }}>* 기간 선택 시 정확한 수량 확인 가능</span>}
                        </div>
                        {eq.description && <p style={{ fontSize: 13, color: "#666", margin: "5px 0 0" }}>{eq.description}</p>}
                      </div>
                      {avail > 0 && datesSelected && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <button style={{ ...s.btnSm, width: 30, padding: "4px 0", textAlign: "center" }} onClick={() => setCart(c => ({ ...c, [eq.id]: Math.max(0, (c[eq.id] || 0) - 1) }))}>-</button>
                          <span style={{ minWidth: 20, textAlign: "center", fontSize: 14, fontWeight: 500 }}>{cartQty}</span>
                          <button style={{ ...s.btnSm, width: 30, padding: "4px 0", textAlign: "center" }} onClick={() => setCart(c => ({ ...c, [eq.id]: Math.min(avail, (c[eq.id] || 0) + 1) }))}>+</button>
                        </div>
                      )}
                      {avail > 0 && !datesSelected && (
                        <span style={{ fontSize: 12, color: "#aaa" }}>기간 선택 후 신청 가능</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {activeCart && datesSelected && (
              <div style={{ ...s.card, border: "1px solid #185FA5" }}>
                <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 12, color: "#185FA5" }}>대여 신청 ({cartItems.length}종)</p>
                <div style={{ marginBottom: 12 }}>
                  {cartItems.map(i => (
                    <div key={i.equipmentId} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0", borderBottom: "0.5px solid #eee" }}>
                      <span>{i.equipmentName}</span><span style={{ fontWeight: 500 }}>{i.qty}대</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 4, fontSize: 13, color: "#666" }}>기간: {startDate} ~ {endDate}</div>
                <div style={{ marginBottom: 12, marginTop: 10 }}><label style={s.label}>메모 (선택)</label><input style={s.input} placeholder="촬영 목적 등" value={rentalNote} onChange={e => setRentalNote(e.target.value)} /></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...s.btnPrimary, flex: 1 }} onClick={handleRentalRequest}>신청하기</button>
                  <button style={s.btn} onClick={() => setCart({})}>초기화</button>
                </div>
              </div>
            )}
          </div>
        )}

        {userTab === "status" && (
          <div>
            {currentlyRented.length === 0 && (
              <p style={{ fontSize: 14, color: "#666" }}>현재 대여 중인 장비가 없습니다.</p>
            )}
            {currentlyRented.map(r => (
              <div key={r.id} style={s.card}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
                  {r.items && r.items.map(i => (
                    <span key={i.equipmentId} style={{ display: "inline-block", fontSize: 13, background: "#faece7", color: "#993C1D", borderRadius: 4, padding: "2px 10px", fontWeight: 500 }}>{i.equipmentName} {i.qty}대</span>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>
                  대여 기간: <span style={{ color: "#111", fontWeight: 500 }}>{r.start_date} ~ {r.end_date}</span>
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#666", flexWrap: "wrap" }}>
                  <span>담당자: <span style={{ color: "#111" }}>{r.user_name}</span></span>
                  <span>부서: <span style={{ color: "#111" }}>{r.user_department || "-"}</span></span>
                  <span>연락처: <span style={{ color: "#111" }}>{r.user_phone}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}

        {userTab === "myrentals" && (
          <div>
            {myRentals.length === 0 && <p style={{ fontSize: 14, color: "#666" }}>대여 신청 내역이 없습니다.</p>}
            {myRentals.map(r => <RentalCard key={r.id} r={r} s={s} onCancel={handleCancel} isUser />)}
          </div>
        )}
      </div>
    );
  }

  return null;
}