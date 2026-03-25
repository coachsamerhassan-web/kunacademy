<?php
/**
 * Plugin Name: Kun REST Export (Temporary)
 * Description: Exposes kun_testimonial and Tutor LMS lessons via REST API for migration.
 * Version: 1.0.0
 * 
 * INSTALL: Copy this file to wp-content/mu-plugins/kun-rest-export.php
 * REMOVE: Delete after migration is complete.
 */

// Expose kun_testimonial to REST API
add_action('init', function () {
    global $wp_post_types;
    if (isset($wp_post_types['kun_testimonial'])) {
        $wp_post_types['kun_testimonial']->show_in_rest = true;
        $wp_post_types['kun_testimonial']->rest_base = 'kun_testimonial';
    }
    // Tutor LMS lessons
    if (isset($wp_post_types['lesson'])) {
        $wp_post_types['lesson']->show_in_rest = true;
        $wp_post_types['lesson']->rest_base = 'tutor_lesson';
    }
    if (isset($wp_post_types['topics'])) {
        $wp_post_types['topics']->show_in_rest = true;
        $wp_post_types['topics']->rest_base = 'tutor_topic';
    }
}, 20);

// Custom endpoint for testimonials with all meta
add_action('rest_api_init', function () {
    register_rest_route('kun-export/v1', '/testimonials', [
        'methods' => 'GET',
        'callback' => function ($request) {
            $page = $request->get_param('page') ?: 1;
            $per_page = min($request->get_param('per_page') ?: 100, 100);

            $query = new WP_Query([
                'post_type' => 'kun_testimonial',
                'posts_per_page' => $per_page,
                'paged' => $page,
                'post_status' => 'publish',
            ]);

            $items = [];
            foreach ($query->posts as $post) {
                $meta = get_post_meta($post->ID);
                $items[] = [
                    'id' => $post->ID,
                    'title' => $post->post_title,
                    'content' => $post->post_content,
                    'excerpt' => $post->post_excerpt,
                    'date' => $post->post_date,
                    'meta' => array_map(function ($v) {
                        return is_array($v) ? ($v[0] ?? null) : $v;
                    }, $meta),
                ];
            }

            return [
                'total' => (int) $query->found_posts,
                'pages' => $query->max_num_pages,
                'page' => (int) $page,
                'items' => $items,
            ];
        },
        'permission_callback' => '__return_true',
    ]);

    // Lessons with video URLs and course mapping
    register_rest_route('kun-export/v1', '/lessons', [
        'methods' => 'GET',
        'callback' => function ($request) {
            $page = $request->get_param('page') ?: 1;
            $per_page = min($request->get_param('per_page') ?: 100, 100);

            $query = new WP_Query([
                'post_type' => 'lesson',
                'posts_per_page' => $per_page,
                'paged' => $page,
                'post_status' => 'publish',
                'orderby' => 'menu_order',
                'order' => 'ASC',
            ]);

            $items = [];
            foreach ($query->posts as $post) {
                $meta = get_post_meta($post->ID);
                $items[] = [
                    'id' => $post->ID,
                    'title' => $post->post_title,
                    'content' => $post->post_content,
                    'parent_id' => $post->post_parent,
                    'menu_order' => $post->menu_order,
                    'date' => $post->post_date,
                    'video_url' => $meta['_video']?? ($meta['_tutor_course_video']?? null),
                    'duration' => $meta['_lesson_duration']?? null,
                    'meta' => array_map(function ($v) {
                        return is_array($v) ? ($v[0] ?? null) : $v;
                    }, $meta),
                ];
            }

            return [
                'total' => (int) $query->found_posts,
                'pages' => $query->max_num_pages,
                'page' => (int) $page,
                'items' => $items,
            ];
        },
        'permission_callback' => '__return_true',
    ]);
});
