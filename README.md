# 🚀 CDC Action Zone V2 Thai Stock Trading Bot (ระบบเทรดหุ้นไทยสูตรลุงโฉลก)

ระบบบอทเทรดหุ้นไทย (SET / SET50 / SET100) อัตโนมัติตามทฤษฎีและอินดิเคเตอร์ **CDC Action Zone V2 (ลุงโฉลก - Chaloke.org)** พร้อมระบบบริหารจัดการความเสี่ยง (Risk Management) และความปลอดภัยระดับสูง

---

## 🌟 จุดเด่นและฟีเจอร์หลัก (Key Features)

- 👑 **กลยุทธ์ตามทฤษฎีลุงโฉลก (Uncle Chaloke CDC Action Zone V2):**
  - ตรวจจับจุดตัด **Golden Cross (EMA 12 ตัดขึ้น EMA 26)** และ **Dead Cross (EMA 12 ตัดลง EMA 26)**
  - คอนเฟิร์มสัญญาณเข้าซื้อที่แท่งสดใหม่ (**Crossover Recency Engine: `barsSince <= 1`**)
  - กฎเหล็กตามระบบ: **"เขียวซื้อ แดงขาย"** เข้าซื้อแท่งฟ้า/เขียวแรกหลังจุดตัด และขายทำกำไร/ถือเงินสดเมื่อเกิดแท่งแดงแรก
  - ป้องกันการซื้อไล่ราคาบนดอย และช่วยรักษาวินัยการลงทุน 100%
- 💼 **เมนูใหม่: กระเป๋าเงิน & พอร์ตหุ้น (Realtime Wallet & Stock Portfolio):**
  - ตรวจสอบยอดเงินสดคงเหลือ (Available THB Cash) และมูลค่าหุ้นในพอร์ตแบบเรียลไทม์
  - คำนวณมูลค่าพอร์ตสุทธิ (Total Equity) และสัดส่วนสินทรัพย์ (Asset Allocation % เงินสด vs หุ้น)
  - ตารางแสดงรายการหุ้นที่ถือครอง (Active Holdings) พร้อมคำนวณต้นทุนเฉลี่ย, ราคาตลาด, กำไร/ขาดทุน (PnL ฿ และ %)
  - ปุ่มกด "ดูกราฟ CDC" และ "ขายทันที (Close Position)" แบบ 1-Click
- 🌐 **สแกนหุ้นทั้งตลาด (All SET + mai Market Scanner):**
  - สแกนและจัดอันดับด้วย **Quality Score (0 - 100 คะแนน)**
  - รองรับ Universe ทั้งตลาด: **All Market**, **SET100**, **SET50**, **sSET**, **mai**, **Watchlist**
- ⚖️ **ระบบจัดสรรเงินทุนและกฎ Board Lot (100 หุ้น):**
  - คำนวณขนาดไม้ตามกฎ **Board Lot (ขั้นต่ำ 100 หุ้น)** ตามเกณฑ์ตลาดหลักทรัพย์แห่งประเทศไทย (SET)
  - กระจายเงินลงทุนถัวเฉลี่ยต่อหุ้นเท่ากัน (**Equal Weight Money Management**)
  - ระบบจำกัดจำนวนหุ้นที่ถือครองพร้อมกัน (**Max Open Positions Slots**) ป้องกันเงินจม
- ⚡ **เชื่อมต่อตรงกับ InnovestX Open API & Paper Trading:**
  - รองรับการเชื่อมต่อกับ **InnovestX Open API** (App Key, App Secret, Account No, Broker ID `023`, Trading PIN)
  - โหมด **Paper Trading (พอร์ตจำลอง ฿100,000)** สำหรับฝึกฝนระบบอย่างปลอดภัย
- 📲 **ระบบแจ้งเตือนผ่าน Telegram (Telegram Bot Realtime Alerts):**
  - แจ้งเตือนเมื่อเกิดสัญญาณเข้าซื้อ (Buy Entry), ปิดสถานะ (Sell / TP / SL / Trailing Stop), สรุปผลกำไร-ขาดทุน
  - แจ้งเตือนสถานะการเปิด/ปิดบอท และมีระบบทดสอบส่งข้อความ (Test Alert)
- 🧪 **ระบบทดสอบย้อนหลัง (Backtesting Engine):**
  - คำนวณ PnL, Win Rate, Profit Factor, Max Drawdown และกราฟการเติบโตของพอร์ต (Equity Curve)
- 🤖 **วิเคราะห์โครงสร้างราคาด้วย Gemini AI (CDC Specialist):**
  - ผู้ช่วย AI วิเคราะห์แนวรับ-แนวต้าน แนวโน้มราคา และประเมินความเสี่ยงเชิงลึก

---

## 🛠️ วิธีการติดตั้งและเริ่มใช้งาน (Getting Started)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. รันระบบ (Development Mode)
```bash
npm run dev
```
เปิดบราวเซอร์ไปที่ `http://localhost:3000`

### 3. บิลด์สำหรับ Production
```bash
npm run build
npm start
```

---

## ☕ ผู้พัฒนาระบบ & ข้อมูลสนับสนุน (Support Developer)

หากระบบนี้มีประโยชน์ต่อการลงทุนในตลาดหุ้นไทยของคุณ สามารถร่วมสนับสนุนค่าน้ำ ค่าไฟ ค่ากาแฟ เพื่อเป็นกำลังใจในการพัฒนาต่อไปได้ที่:

- **ชื่อบัญชี:** นายสุรเดช ชูสวัสดิ์
- **ธนาคาร:** ธนาคารกรุงไทย (KTB) สาขาถลาง
- **เลขที่บัญชี:** `388-0-377316`
- **พร้อมเพย์ (PromptPay):** `098-017-8791`

---

## 📄 License
MIT License
