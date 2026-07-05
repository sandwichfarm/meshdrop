#define _GNU_SOURCE

#include <errno.h>
#include <libgen.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static int resolve_executable_dir(char *buffer, size_t size) {
    ssize_t length = readlink("/proc/self/exe", buffer, size - 1);

    if (length < 0 || (size_t) length >= size) {
        return -1;
    }

    buffer[length] = '\0';
    char *directory = dirname(buffer);
    size_t directory_length = strlen(directory);

    if (directory_length + 1 > size) {
        return -1;
    }

    memmove(buffer, directory, directory_length + 1);
    return 0;
}

int main(int argc, char **argv) {
    char executable_dir[PATH_MAX];
    char script_path[PATH_MAX];

    if (resolve_executable_dir(executable_dir, sizeof(executable_dir)) != 0) {
        fprintf(stderr, "MeshDrop launcher could not resolve its executable directory: %s\n", strerror(errno));
        return 70;
    }

    int written = snprintf(script_path, sizeof(script_path), "%s/meshdrop-desktop-chromium.mjs", executable_dir);
    if (written < 0 || (size_t) written >= sizeof(script_path)) {
        fprintf(stderr, "MeshDrop launcher script path is too long\n");
        return 70;
    }

    char **node_argv = calloc((size_t) argc + 2, sizeof(char *));
    if (!node_argv) {
        fprintf(stderr, "MeshDrop launcher could not allocate argv\n");
        return 70;
    }

    node_argv[0] = "node";
    node_argv[1] = script_path;
    for (int i = 1; i < argc; i += 1) {
        node_argv[i + 1] = argv[i];
    }
    node_argv[argc + 1] = NULL;

    execvp("node", node_argv);
    fprintf(stderr, "MeshDrop launcher could not exec node: %s\n", strerror(errno));
    free(node_argv);
    return 69;
}
