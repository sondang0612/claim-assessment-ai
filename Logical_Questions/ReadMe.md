# Logical Questions - Đặng Hoàng Sơn

## Khởi động

### Q4 — Ký ức đầu tiên của bạn là gì? · [M]

Ký ức đầu tiên của tôi là những lần cùng gia đình đi đón mẹ tan ca vào ban đêm.

Tôi không chắc chính xác có phải tối thứ Sáu hay không, nhưng tôi nhớ cảm giác đó thường xảy ra vào những đêm cả nhà có thể thức lâu hơn để chờ mẹ. Tôi nhớ cả nhà cùng mặc áo mưa, trời lúc đó mưa nhẹ và se lạnh, nhưng lại rất ấm áp và yên bình.

---

### Q10 — Tên con thú cưng bạn thích nhất, và những tên khác bạn muốn đặt · [N, M]

Khoảng 4 năm trước, tôi đã nhận nuôi một chú mèo và đặt tên là **Cốm**.

Thật ra lúc đặt tên tôi cũng không suy nghĩ quá nhiều, tôi thấy cái tên Cốm nghe dễ thương và gần gũi. Sau đó tôi tình cờ biết được ý nghĩa của tên này liên quan tới lúa nếp non, và ông tôi trước đây cũng từng làm nghề liên quan tới nếp, nên tự nhiên thấy nó có một chút ý nghĩa với gia đình.

Nếu sau này nuôi thêm thì tôi vẫn thích những kiểu tên như:

- Nếp
- Tẻ
- Bắp
- Gạo
- Thóc

Nghe gần gũi, dễ gọi với lại cũng có cảm giác quen thuộc.

---

## Trung cấp

### Q3 — Người bán hàng nào dễ chịu nhất? · [O]

Người bán hàng tôi thấy dễ chịu nhất đó chính là anh bán món ăn Thái gần nhà vợ tôi.

Khoảng cách từ nhà tôi tới chỗ bán khoảng 5km. Mỗi lần tôi vừa dựng xe trước khây xe đẩy, anh ấy thường cười và hỏi:

> "Như cũ hả em?"

Có những hôm quán rất đông nhưng anh ấy vẫn nhớ phần của tôi và có một sự ưu tiên nhẹ dành cho tôi.

Khi tôi mang thiếu tiền anh ấy chỉ cười và nói:

> "Hôm sau trả cũng được"

Mặc dù dạo gần đây vì lý do thời tiết nên tôi ít ghé mua như xưa.

Tôi từng thấy một khách hàng góp ý rằng món này sẽ ngon hơn khi có thêm trứng non. Anh ấy hỏi lại ý kiến của nhiều khách hàng khác (trong đó có tôi), sau đó mới thêm vào để món ăn trở nên tốt nhất có thể.

Đó cũng là một trong những tính cách tôi rất thích từ anh ấy.

---

### Q6 — Vị trí nào trong hàng đợi vào rạp chiếu phim là tốt nhất? · [O]

Không phải tôi thích chờ lâu hay gì, mà đơn giản tôi thấy không cần phải vào sớm.

Vé thì cũng mua trước và ghế cũng đã chọn rồi nên việc đứng giữa hàng hay đầu hàng cũng không thay đổi nhiều.

Đứng cuối hàng tôi sẽ thấy thoải mái hơn vì không bị áp lực dồn hàng từ những người phía sau. Với lại tôi có thể quan sát được xem hàng nào nhanh hơn hay chậm hơn, nếu có vấn đề thì có thể đổi sang hàng khác cho tiện.

Tôi cũng không có thói quen vào rạp sớm để xem quảng cáo hay ngồi chờ, nên với tôi đứng cuối hàng là sự lựa chọn tốt nhất.

---

## Chuyên sâu

### Q12 — Viết hướng dẫn đổ xăng tại cây xăng nhanh nhất có thể · [Cr, Q]

#### Giả định

- Xe máy
- Cây xăng có 4 nhân viên, nhiều trụ
- Hình thức thanh toán: QR / tiền mặt
- Mục tiêu: tối ưu tổng thời gian từ lúc vào làn tới lúc rời đi

---

### Bước 1: Quan sát hệ thống trước khi vào (10 – 15 giây)

- Không dắt xe vào ngay và phải quan sát.

#### 1. Trạng thái đợi của mỗi làn

- Số lượng xe đang chờ
- Xe nào sắp xong có làm tắt nghẽn hàng hay không

#### 2. Tốc độ thanh toán từng làn

- QR:
  - Có bị nghẽn do ngân hàng, mạng, điện thoại quá cũ

- Tiền mặt:
  - Có chờ tiền thối từ nhân viên hay không
  - Nhân viên phải đi đổi tiền thối hay không

#### 3. Trạng thái nhân viên

- Tuy 4 nhân viên nhưng có thể có người đi đổi tiền
- Có người phải chờ xử lý thanh toán QR

**=> Chọn hàng có thời gian chờ ít nhất chứ không phải chọn hàng ít xe nhất.**

---

### Bước 2: Chọn làn tối ưu

**Công thức đơn giản:**

```text
(số lượng xe × thời gian trung bình mỗi xe)
+ thời gian bị delay do thanh toán
```

Ưu tiên làn theo thứ tự sau:

1. Ưu tiên làn có xe đang đổ hoặc thanh toán xong → giảm thời gian đợi ngay lập tức.
2. Ưu tiên làn không thanh toán QR nhiều.
3. Ưu tiên làn sau khi đổ xong thì không cần quay đầu để lui ra.

---

### Bước 3: Chuẩn bị trong thời gian chờ tới lượt

- Mở sẵn QR / ngân hàng.
- Hoặc chuẩn bị đúng tiền mặt (không cần thối).

#### Tối ưu

- Nếu QR hoặc ngân hàng chậm do mạng thì đổi sang tiền mặt ngay từ đầu.
- Không đợi tới lượt mới mở app hoặc chuẩn bị tiền.

**=> Giảm 20 – 40% thời gian chết.**

---

### Bước 4: Khi tới lượt

- Đi sát tới trụ, tránh nhân viên phải kéo ống đổ xăng ra xa.
- Tắt máy và mở nắp bình ngay lập tức.
- Tránh trao đổi dài dòng.

#### Tối ưu

Nói ngắn gọn:

> "Đầy bình"

hoặc

> "50 ngàn"

Tránh diễn giải dài dòng.

---

### Bước 5: Trong lúc nhân viên đang đổ xăng

- Kiểm tra số tiền hiển thị, tránh hỏi lại tốn thời gian.
- Chuẩn bị QR hoặc tiền mặt.
- Quan sát tín hiệu dừng bơm để thanh toán.

**Tránh tình trạng đổ xong rồi mới bắt đầu chuẩn bị thanh toán.**

---

### Bước 6: Thanh toán

#### Đối với QR

1. Mở app trước.
2. Scan QR hoặc nhập thông tin.
3. Xác thực.
4. Kiểm tra lại số tiền.
5. Thanh toán.

#### Đối với tiền mặt

- Đưa đúng mệnh giá để tránh chờ thối tiền.

---

### Bước 7: Sau khi thanh toán xong và chuẩn bị rời đi

- Đóng nắp xe.
- Kiểm tra sơ bộ.
- Rời đi.

#### Tối ưu

- Di chuyển thẳng thay vì quay lui.

Vì việc quay lui có thể ảnh hưởng tới những người phía sau phải lùi xe theo.

---

## Xử lý một vài trường hợp đặc biệt

### Giờ cao điểm

Ưu tiên làn có số lượng người dùng tiền mặt nhiều hơn người dùng QR vì thanh toán tiền mặt thường ổn định hơn QR.

### QR chậm hoặc mạng yếu

- Đổi sang tiền mặt ngay lập tức.
- Hoặc đi đổi tiền rồi quay lại.

Việc này nên được kiểm tra ngay trong lúc chờ tới lượt thay vì đợi đến khi bắt đầu thanh toán mới xử lý.
