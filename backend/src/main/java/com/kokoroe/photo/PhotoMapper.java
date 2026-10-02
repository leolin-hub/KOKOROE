package com.kokoroe.photo;

import com.kokoroe.photo.dto.PhotoResponse;

/** Entity → DTO 轉換。理由同 {@code FilmRollMapper}：沒有相依的純函式，不做成 bean。 */
public final class PhotoMapper {

    private PhotoMapper() {
        throw new AssertionError("工具類別不應被實例化");
    }

    public static PhotoResponse toResponse(Photo photo) {
        return new PhotoResponse(
                photo.getId(),
                photo.getFilmRollId(),
                photo.getFrameNumber(),
                photo.getOriginalFilename(),
                photo.getWidth(),
                photo.getHeight(),
                photo.getSizeBytes(),
                photo.getCreatedAt()
        );
    }
}
