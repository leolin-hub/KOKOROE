package com.kokoroe.camera;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 相機資料存取。 */
public interface CameraRepository extends JpaRepository<Camera, Long> {

    /**
     * 是否已有同品牌、同型號的相機（不分大小寫），比對規則與唯一索引 {@code uq_camera_brand_model} 一致。
     *
     * @param excludeId 更新時排除自己；新增時傳 null
     */
    @Query("""
            select count(c) > 0 from Camera c
            where lower(coalesce(c.brand, '')) = lower(coalesce(:brand, ''))
              and lower(c.model) = lower(:model)
              and (:excludeId is null or c.id <> :excludeId)
            """)
    boolean existsDuplicate(@Param("brand") String brand,
                            @Param("model") String model,
                            @Param("excludeId") Long excludeId);

    /**
     * 有幾卷底片使用這台相機。
     *
     * <p>寫成 JPQL 而不是注入 {@code FilmRollRepository}：
     * {@code filmroll} 套件已經依賴 {@code camera}，反過來依賴會形成循環。
     */
    @Query("select count(r) from FilmRoll r where r.camera.id = :cameraId")
    long countFilmRollsUsing(@Param("cameraId") Long cameraId);
}
