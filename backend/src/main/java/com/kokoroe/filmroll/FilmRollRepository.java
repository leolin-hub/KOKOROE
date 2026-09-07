package com.kokoroe.filmroll;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 卷期資料存取。
 *
 * <p>只宣告分頁版本的查詢，不提供無上限的 {@code findAll()} 對外使用 ——
 * 資料量成長後，未分頁的全表撈取是最典型的效能地雷。
 */
public interface FilmRollRepository extends JpaRepository<FilmRoll, Long> {

    Page<FilmRoll> findByStatus(FilmRollStatus status, Pageable pageable);
}
