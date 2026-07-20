-- RhyMic Supabase Row Level Security Policies
-- Run this SQL in the Supabase SQL Editor to enable RLS on all tables
-- and create proper policies scoped to auth.uid()

-- ============================================
-- Enable RLS on all tables
-- ============================================
ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_song ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liked_song ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.song_moods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artist_image ENABLE ROW LEVEL SECURITY;

-- ============================================
-- User table: users can only see/edit their own record
-- ============================================
CREATE POLICY user_select_own ON public."user"
    FOR SELECT
    USING (id::text = auth.uid()::text);

CREATE POLICY user_update_own ON public."user"
    FOR UPDATE
    USING (id::text = auth.uid()::text);

-- Prevent users from deleting their own account via API
-- (handle account deletion through a support process)

-- ============================================
-- Song table: read-only for everyone, insert-only by service
-- Songs are a shared library - all authenticated users can read
-- ============================================
CREATE POLICY song_select_all ON public.song
    FOR SELECT
    USING (true);

-- ============================================
-- Playlist table: users can CRUD their own playlists
-- System playlists are readable by all authenticated users
-- ============================================
CREATE POLICY playlist_select_own_or_system ON public.playlist
    FOR SELECT
    USING (
        user_id::text = auth.uid()::text
        OR is_system = true
    );

CREATE POLICY playlist_insert_own ON public.playlist
    FOR INSERT
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY playlist_update_own ON public.playlist
    FOR UPDATE
    USING (user_id::text = auth.uid()::text);

CREATE POLICY playlist_delete_own ON public.playlist
    FOR DELETE
    USING (user_id::text = auth.uid()::text);

-- ============================================
-- PlaylistSong table: users can manage songs in their own playlists
-- ============================================
CREATE POLICY playlistsong_select_own ON public.playlist_song
    FOR SELECT
    USING (
        playlist_id IN (
            SELECT id FROM public.playlist
            WHERE user_id::text = auth.uid()::text OR is_system = true
        )
    );

CREATE POLICY playlistsong_insert_own ON public.playlist_song
    FOR INSERT
    WITH CHECK (
        playlist_id IN (
            SELECT id FROM public.playlist
            WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY playlistsong_delete_own ON public.playlist_song
    FOR DELETE
    USING (
        playlist_id IN (
            SELECT id FROM public.playlist
            WHERE user_id::text = auth.uid()::text
        )
    );

-- ============================================
-- LikedSong table: users can manage their own likes
-- ============================================
CREATE POLICY likedsong_select_own ON public.liked_song
    FOR SELECT
    USING (user_id::text = auth.uid()::text);

CREATE POLICY likedsong_insert_own ON public.liked_song
    FOR INSERT
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY likedsong_delete_own ON public.liked_song
    FOR DELETE
    USING (user_id::text = auth.uid()::text);

-- ============================================
-- SongMoods table: readable by all authenticated users
-- ============================================
CREATE POLICY songmoods_select_all ON public.song_moods
    FOR SELECT
    USING (true);

-- ============================================
-- ArtistImage table: readable by all authenticated users
-- ============================================
CREATE POLICY artistimage_select_all ON public.artist_image
    FOR SELECT
    USING (true);
