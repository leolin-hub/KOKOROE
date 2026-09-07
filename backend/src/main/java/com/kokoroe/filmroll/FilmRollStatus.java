package com.kokoroe.filmroll;

/**
 * 底片卷期狀態，對應真實工作流程：裝片 → 拍攝 → 送洗 → 歸檔。
 *
 * <p>狀態只能向前推進或維持不變，不允許逆向（例如已歸檔又改回拍攝中）。
 * 允許「跳關」（例如 LOADED 直接到 ARCHIVED），因為現實中確實會發生
 * 「這卷片報銷了直接歸檔」的情況。
 */
public enum FilmRollStatus {

    LOADED(0),
    SHOOTING(1),
    DEVELOPING(2),
    ARCHIVED(3);

    /**
     * 流程順序。刻意用明確欄位而非 {@code ordinal()}：
     * 一旦有人調整了常數的宣告順序，依賴 ordinal 的規則會無聲地改變語意。
     */
    private final int sequence;

    FilmRollStatus(int sequence) {
        this.sequence = sequence;
    }

    /**
     * 是否可以從目前狀態流轉到 {@code target}。
     *
     * <p>抽成純函式（無 I/O、無相依），是整個系統最容易寫窮舉單元測試的地方。
     */
    public boolean canTransitionTo(FilmRollStatus target) {
        return target != null && target.sequence >= this.sequence;
    }
}
