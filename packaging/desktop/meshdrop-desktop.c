#include <errno.h>
#include <gtk/gtk.h>
#include <stdio.h>
#include <string.h>
#include <webkit/webkit.h>

typedef struct {
    char *app_dir;
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

static void activate(GtkApplication *app, gpointer user_data)
{
    MeshDropConfig *config = user_data;
    GtkWidget *window = gtk_application_window_new(app);
    GtkWidget *web_view = webkit_web_view_new();
    char *uri = file_uri_for_index(config->app_dir);

    gtk_window_set_title(GTK_WINDOW(window), "MeshDrop");
    gtk_window_set_default_size(GTK_WINDOW(window), 1180, 780);
    gtk_window_set_child(GTK_WINDOW(window), web_view);
    webkit_web_view_load_uri(WEBKIT_WEB_VIEW(web_view), uri);
    gtk_window_present(GTK_WINDOW(window));

    g_free(uri);
}

int main(int argc, char **argv)
{
    gboolean print_config = FALSE;
    MeshDropConfig config = {
        .app_dir = default_app_dir()
    };

    for (int i = 1; i < argc; i += 1) {
        if (strcmp(argv[i], "--meshdrop-print-config") == 0) {
            print_config = TRUE;
        }
        else if (strcmp(argv[i], "--app-dir") == 0 && i + 1 < argc) {
            g_free(config.app_dir);
            config.app_dir = g_strdup(argv[i + 1]);
            i += 1;
        }
        else {
            fprintf(stderr, "Usage: %s [--app-dir PATH] [--meshdrop-print-config]\n", argv[0]);
            g_free(config.app_dir);
            return 64;
        }
    }

    if (print_config) {
        gboolean exists = app_index_exists(config.app_dir);
        print_config_and_exit(config.app_dir);
        g_free(config.app_dir);
        return exists ? 0 : 66;
    }

    if (!app_index_exists(config.app_dir)) {
        fprintf(stderr, "MeshDrop app assets not found in %s: %s\n", config.app_dir, strerror(ENOENT));
        g_free(config.app_dir);
        return 66;
    }

    GtkApplication *app = gtk_application_new("farm.sandwich.meshdrop", G_APPLICATION_DEFAULT_FLAGS);
    g_signal_connect(app, "activate", G_CALLBACK(activate), &config);
    int status = g_application_run(G_APPLICATION(app), 0, NULL);

    g_object_unref(app);
    g_free(config.app_dir);

    return status;
}
