import humanize


def base64length_to_string_size(base64length):
    return humanize.naturalsize(base64length * 0.75)
