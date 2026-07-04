#include <errno.h>
#include <gtk/gtk.h>
#include <stdio.h>
#include <string.h>
#include <webkit/webkit.h>

typedef struct {
    char *app_dir;
    char *automation_init_script;
    gboolean automation;
    GtkApplication *app;
} MeshDropConfig;

static char *path_join(const char *left, const char *right)
{
    return g_build_filename(left, right, NULL);
}

static char *default_app_dir(void)
{
    char *executable = g_file_read_link("/proc/self/exe", NULL);
    if (executable == NULL) {
        return g_strdup("app");
    }

    char *bin_dir = g_path_get_dirname(executable);
    char *root_dir = g_path_get_dirname(bin_dir);
    char *app_dir = path_join(root_dir, "app");

    g_free(executable);
    g_free(bin_dir);
    g_free(root_dir);

    return app_dir;
}

static gboolean app_index_exists(const char *app_dir)
{
    char *index_path = path_join(app_dir, "index.html");
    gboolean exists = g_file_test(index_path, G_FILE_TEST_IS_REGULAR);

    g_free(index_path);

    return exists;
}

static void print_config_and_exit(const char *app_dir)
{
    printf("{\"target\":\"desktop\",\"nativeShellBuilt\":true,\"appIndexExists\":%s}\n",
        app_index_exists(app_dir) ? "true" : "false");
}

static char *file_uri_for_index(const char *app_dir)
{
    char *index_path = path_join(app_dir, "index.html");
    char *uri = g_filename_to_uri(index_path, NULL, NULL);

    g_free(index_path);

    return uri;
}

static WebKitUserContentManager *create_user_content_manager(const MeshDropConfig *config)
{
    WebKitUserContentManager *manager = webkit_user_content_manager_new();
    char *root_dir = g_path_get_dirname(config->app_dir);
    char *manifest_path = path_join(root_dir, "meshdrop-target.json");
    char *manifest_source = NULL;
    gsize manifest_length = 0;

    if (g_file_get_contents(manifest_path, &manifest_source, &manifest_length, NULL) && manifest_source) {
        char *script_source = g_strdup_printf("globalThis.__meshdropTargetManifest = %s;", manifest_source);
        WebKitUserScript *script = webkit_user_script_new(script_source,
            WEBKIT_USER_CONTENT_INJECT_ALL_FRAMES,
            WEBKIT_USER_SCRIPT_INJECT_AT_DOCUMENT_START,
            NULL,
            NULL);
        webkit_user_content_manager_add_script(manager, script);
        webkit_user_script_unref(script);
        g_free(script_source);
        g_free(manifest_source);
    }
    g_free(manifest_path);
    g_free(root_dir);

    if (!config->automation_init_script) return manager;

    char *source = NULL;
    gsize length = 0;
    GError *error = NULL;

    if (!g_file_get_contents(config->automation_init_script, &source, &length, &error)) {
        fprintf(stderr, "Failed to read automation init script %s: %s\n",
            config->automation_init_script,
            error ? error->message : "unknown error");
        g_clear_error(&error);
        return manager;
    }

    (void)length;
    WebKitUserScript *script = webkit_user_script_new(source,
        WEBKIT_USER_CONTENT_INJECT_ALL_FRAMES,
        WEBKIT_USER_SCRIPT_INJECT_AT_DOCUMENT_START,
        NULL,
        NULL);
    webkit_user_content_manager_add_script(manager, script);
    webkit_user_script_unref(script);
    g_free(source);

    return manager;
}

static WebKitWebView *create_web_view(GtkApplication *app, const MeshDropConfig *config, gboolean controlled_by_automation)
{
    GtkWidget *window = gtk_application_window_new(app);
    WebKitUserContentManager *content_manager = create_user_content_manager(config);
    GtkWidget *web_view = g_object_new(WEBKIT_TYPE_WEB_VIEW,
        "user-content-manager", content_manager,
        "is-controlled-by-automation", controlled_by_automation,
        NULL);
    WebKitSettings *settings = webkit_web_view_get_settings(WEBKIT_WEB_VIEW(web_view));
    char *uri = file_uri_for_index(config->app_dir);

    g_object_unref(content_manager);
    webkit_settings_set_enable_media(settings, TRUE);
    webkit_settings_set_enable_media_stream(settings, TRUE);
    webkit_settings_set_enable_webrtc(settings, TRUE);
    gtk_window_set_title(GTK_WINDOW(window), "MeshDrop");
    gtk_window_set_default_size(GTK_WINDOW(window), 1180, 780);
    gtk_window_set_child(GTK_WINDOW(window), web_view);
    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view), uri);
    gtk_window_present(GTK_WINDOW(window));

    g_free(uri);

    return WEBKIT_WEB_VIEW(web_view);
}

static void activate(GtkApplication *app, gpointer user_data)
{
    MeshDropConfig *config = user_data;

    if (config->automation) {
        g_application_hold(G_APPLICATION(app));
        return;
    }

    create_web_view(app, config, FALSE);
}

static WebKitWebView *automation_create_web_view(WebKitAutomationSession *session, gpointer user_data)
{
    (void)session;
    MeshDropConfig *config = user_data;

    return create_web_view(config->app, config, TRUE);
}

static void automation_will_close(WebKitAutomationSession *session, gpointer user_data)
{
    (void)session;
    MeshDropConfig *config = user_data;

    g_application_release(G_APPLICATION(config->app));
}

static void automation_started(WebKitWebContext *context, WebKitAutomationSession *session, gpointer user_data)
{
    (void)context;
    MeshDropConfig *config = user_data;
    WebKitApplicationInfo *info = webkit_application_info_new();

    webkit_application_info_set_name(info, "MeshDrop");
    webkit_application_info_set_version(info, 0, 0, 0);
    webkit_automation_session_set_application_info(session, info);
    webkit_application_info_unref(info);

    g_signal_connect(session, "create-web-view", G_CALLBACK(automation_create_web_view), config);
    g_signal_connect(session, "will-close", G_CALLBACK(automation_will_close), config);
}

int main(int argc, char **argv)
{
    gboolean print_config = FALSE;
    MeshDropConfig config = {
        .app_dir = default_app_dir(),
        .automation_init_script = NULL,
        .automation = FALSE,
        .app = NULL
    };

    for (int i = 1; i < argc; i += 1) {
        if (strcmp(argv[i], "--meshdrop-print-config") == 0) {
            print_config = TRUE;
        }
        else if (strcmp(argv[i], "--automation") == 0) {
            config.automation = TRUE;
        }
        else if (strcmp(argv[i], "--automation-init-script") == 0 && i + 1 < argc) {
            g_free(config.automation_init_script);
            config.automation_init_script = g_strdup(argv[i + 1]);
            i += 1;
        }
        else if (strcmp(argv[i], "--app-dir") == 0 && i + 1 < argc) {
            g_free(config.app_dir);
            config.app_dir = g_strdup(argv[i + 1]);
            i += 1;
        }
        else {
            fprintf(stderr, "Usage: %s [--app-dir PATH] [--automation] [--automation-init-script PATH] [--meshdrop-print-config]\n", argv[0]);
            g_free(config.app_dir);
            g_free(config.automation_init_script);
            return 64;
        }
    }

    if (print_config) {
        gboolean exists = app_index_exists(config.app_dir);
        print_config_and_exit(config.app_dir);
        g_free(config.app_dir);
        g_free(config.automation_init_script);
        return exists ? 0 : 66;
    }

    if (!app_index_exists(config.app_dir)) {
        fprintf(stderr, "MeshDrop app assets not found in %s: %s\n", config.app_dir, strerror(ENOENT));
        g_free(config.app_dir);
        g_free(config.automation_init_script);
        return 66;
    }

    GtkApplication *app = gtk_application_new("farm.sandwich.meshdrop", G_APPLICATION_NON_UNIQUE);
    config.app = app;
    if (config.automation) {
        WebKitWebContext *context = webkit_web_context_get_default();
        webkit_web_context_set_automation_allowed(context, TRUE);
        g_signal_connect(context, "automation-started", G_CALLBACK(automation_started), &config);
    }
    g_signal_connect(app, "activate", G_CALLBACK(activate), &config);
    int status = g_application_run(G_APPLICATION(app), 0, NULL);

    g_object_unref(app);
    g_free(config.app_dir);
    g_free(config.automation_init_script);

    return status;
}
