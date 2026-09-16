package com.kokoroe.camera;

/** 機型類別。新增常數時，記得同步 V2 migration 的 {@code ck_camera_type}（用新的 migration 改）。 */
public enum CameraType {
    /** 傻瓜機 */
    POINT_AND_SHOOT,
    /** 單眼 */
    SLR,
    /** 旁軸 */
    RANGEFINDER,
    /** 雙眼 */
    TLR,
    /** 即可拍（一次性相機） */
    DISPOSABLE,
    OTHER
}
