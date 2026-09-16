package com.kokoroe.filmroll;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 卷期資料存取。
 *
 * <p>只宣告分頁版本的查詢，不提供無上限的 {@code findAll()} 對外使用 ——
 * 資料量成長後，未分頁的全表撈取是最典型的效能地雷。
 *
 * <p>列表查詢都加上 {@code @EntityGraph} 一起抓相機：{@code camera} 是 LAZY，
 * 不加的話一頁 20 卷會多打 20 次查詢去拿相機（N+1）。
 */
public interface FilmRollRepository extends JpaRepository<FilmRoll, Long> {

    @Override
    @EntityGraph(attributePaths = "camera")
    Page<FilmRoll> findAll(Pageable pageable);

    @EntityGraph(attributePaths = "camera")
    Page<FilmRoll> findByStatus(FilmRollStatus status, Pageable pageable);
}
