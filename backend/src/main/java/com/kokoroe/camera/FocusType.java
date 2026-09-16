package com.kokoroe.camera;

/** 對焦方式。 */
public enum FocusType {
    /** 自動對焦 */
    AUTO,
    /** 手動對焦 */
    MANUAL,
    /** 固定焦點（免對焦，例如即可拍） */
    FIXED,
    /** 區域對焦（選近、中、遠等距離檔位） */
    ZONE
}
