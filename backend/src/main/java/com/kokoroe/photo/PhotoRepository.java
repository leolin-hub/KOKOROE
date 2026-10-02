package com.kokoroe.photo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/**
 * 照片資料存取。
 *
 * <p>列表不分頁：一卷最多 100 格（V4 的 CHECK 加上唯一約束保證），一次全拿最單純。
 */
public interface PhotoRepository extends JpaRepository<Photo, Long> {

    List<Photo> findByFilmRollIdOrderByFrameNumberAsc(Long filmRollId);

    boolean existsByFilmRollIdAndFrameNumber(Long filmRollId, Integer frameNumber);

    @Query("select max(p.frameNumber) from Photo p where p.filmRollId = :filmRollId")
    Optional<Integer> findMaxFrameNumber(Long filmRollId);

    /** 只撈 storage key 一個欄位，不必載入整個實體。 */
    @Query("select p.storageKey from Photo p where p.filmRollId = :filmRollId")
    List<String> findStorageKeysByFilmRollId(Long filmRollId);
}
