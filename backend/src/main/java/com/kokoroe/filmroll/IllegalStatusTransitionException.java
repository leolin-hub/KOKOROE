package com.kokoroe.filmroll;

/**
 * 試圖進行不被允許的狀態流轉。
 *
 * <p>對應 <b>409 Conflict</b> 而非 400：請求格式完全正確，是資源當前的狀態
 * 使這個操作無法進行。區分這兩者能讓前端做出不同反應 ——
 * 400 是「你填錯了，改一下」，409 是「這筆資料已經不是你以為的樣子了，重新整理」。
 */
public class IllegalStatusTransitionException extends RuntimeException {

    public IllegalStatusTransitionException(FilmRollStatus from, FilmRollStatus to) {
        super("不允許的狀態流轉：%s → %s（狀態只能向前推進）".formatted(from, to));
    }
}
