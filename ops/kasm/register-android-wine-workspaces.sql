-- CHANGE: register Android Redroid and Windows Apps Wine tiles in Kasm
-- WHY: the Kasm dashboard should expose Android and Wine sessions like the default apps.
-- QUOTE(TZ): "что бы я мог открыть андроид и виндоус приложения через нашу панель"
-- REF: user request 2026-05-09
-- SOURCE: https://kasmweb.com/docs/latest/guide/workspace_registry.html
-- PURITY: SHELL (database migration)
-- INVARIANT: each workspace is enabled, bound to All Users, and has a persistent profile path

BEGIN;

UPDATE group_settings
SET value = 'True'
WHERE name IN (
  'allow_kasm_clipboard_down',
  'allow_kasm_clipboard_up',
  'allow_kasm_downloads',
  'allow_kasm_uploads',
  'allow_persistent_profile'
);

DO $$
DECLARE
  all_users_group_id uuid;
  running_server_id uuid;
  redroid_image_id uuid;
  wine_image_id uuid;
BEGIN
  SELECT group_id INTO all_users_group_id
  FROM groups
  WHERE name = 'All Users'
  LIMIT 1;

  SELECT server_id INTO running_server_id
  FROM servers
  WHERE operational_status = 'running'
  ORDER BY hostname
  LIMIT 1;

  SELECT image_id INTO redroid_image_id
  FROM images
  WHERE name = 'kasmweb/redroid:1.18.0'
     OR friendly_name = 'Android (Redroid)'
  LIMIT 1;

  IF redroid_image_id IS NULL THEN
    redroid_image_id := uuid_generate_v4();

    INSERT INTO images (
      image_id,
      cores,
      description,
      docker_registry,
      image_src,
      enabled,
      available,
      friendly_name,
      memory,
      name,
      x_res,
      y_res,
      run_config,
      volume_mappings,
      persistent_profile_path,
      exec_config,
      categories,
      image_type,
      launch_config,
      notes,
      uncompressed_size_mb,
      enforce_workspace_persistence
    )
    VALUES (
      redroid_image_id,
      2,
      'Android workspace powered by Redroid and scrcpy.',
      'https://index.docker.io/v1/',
      'img/thumbnails/android.svg',
      true,
      true,
      'Android (Redroid)',
      2768000000,
      'kasmweb/redroid:1.18.0',
      800,
      600,
      '{"environment":{"ANDROID_VERSION":"15.0.0","REDROID_GPU_GUEST_MODE":"guest","REDROID_FPS":"30","REDROID_WIDTH":"720","REDROID_HEIGHT":"1280","REDROID_DPI":"320","REDROID_SHOW_CONSOLE":"1","REDROID_DISABLE_AUTOSTART":"0","REDROID_DISABLE_HOST_CHECKS":"0"},"privileged":true}'::json,
      '{}'::json,
      '/mnt/kasm_profiles/android-redroid/{username}',
      '{}'::json,
      '["Android","Mobile","Development"]'::json,
      'Container',
      '{}'::json,
      'Requires host binder_linux devices: binder,hwbinder,vndbinder.',
      3897,
      true
    );
  ELSE
    UPDATE images
    SET enabled = true,
        available = true,
        friendly_name = 'Android (Redroid)',
        image_src = 'img/thumbnails/android.svg',
        docker_registry = 'https://index.docker.io/v1/',
        run_config = '{"environment":{"ANDROID_VERSION":"15.0.0","REDROID_GPU_GUEST_MODE":"guest","REDROID_FPS":"30","REDROID_WIDTH":"720","REDROID_HEIGHT":"1280","REDROID_DPI":"320","REDROID_SHOW_CONSOLE":"1","REDROID_DISABLE_AUTOSTART":"0","REDROID_DISABLE_HOST_CHECKS":"0"},"privileged":true}'::json,
        persistent_profile_path = '/mnt/kasm_profiles/android-redroid/{username}',
        exec_config = '{}'::json,
        categories = '["Android","Mobile","Development"]'::json,
        enforce_workspace_persistence = true
    WHERE image_id = redroid_image_id;
  END IF;

  SELECT image_id INTO wine_image_id
  FROM images
  WHERE name = 'docker-git-kasm-wine:1.18.0'
     OR friendly_name = 'Windows Apps (Wine)'
  LIMIT 1;

  IF wine_image_id IS NULL THEN
    wine_image_id := uuid_generate_v4();

    INSERT INTO images (
      image_id,
      cores,
      description,
      docker_registry,
      image_src,
      enabled,
      available,
      friendly_name,
      memory,
      name,
      x_res,
      y_res,
      run_config,
      volume_mappings,
      persistent_profile_path,
      exec_config,
      categories,
      image_type,
      launch_config,
      notes,
      uncompressed_size_mb,
      enforce_workspace_persistence
    )
    VALUES (
      wine_image_id,
      2,
      'Wine desktop for installing and running simple Windows EXE/MSI apps.',
      '',
      'img/thumbnails/ubuntu.png',
      true,
      true,
      'Windows Apps (Wine)',
      2768000000,
      'docker-git-kasm-wine:1.18.0',
      800,
      600,
      '{"hostname":"kasm"}'::json,
      '{}'::json,
      '/mnt/kasm_profiles/windows-wine/{username}',
      '{}'::json,
      '["Windows","Productivity","Development"]'::json,
      'Container',
      '{}'::json,
      'Runs Windows applications through Wine; real Windows VM/RDP remains a separate option.',
      8000,
      true
    );
  ELSE
    UPDATE images
    SET enabled = true,
        available = true,
        friendly_name = 'Windows Apps (Wine)',
        image_src = 'img/thumbnails/ubuntu.png',
        docker_registry = '',
        run_config = '{"hostname":"kasm"}'::json,
        persistent_profile_path = '/mnt/kasm_profiles/windows-wine/{username}',
        exec_config = '{}'::json,
        categories = '["Windows","Productivity","Development"]'::json,
        enforce_workspace_persistence = true
    WHERE image_id = wine_image_id;
  END IF;

  IF all_users_group_id IS NOT NULL THEN
    INSERT INTO group_images (group_id, image_id)
    SELECT all_users_group_id, redroid_image_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM group_images
      WHERE group_id = all_users_group_id
        AND image_id = redroid_image_id
    );

    INSERT INTO group_images (group_id, image_id)
    SELECT all_users_group_id, wine_image_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM group_images
      WHERE group_id = all_users_group_id
        AND image_id = wine_image_id
    );
  END IF;

  IF running_server_id IS NOT NULL THEN
    INSERT INTO server_image_slots (server_id, image_id, slot_count)
    VALUES (running_server_id, redroid_image_id, 6)
    ON CONFLICT (server_id, image_id) DO UPDATE
    SET slot_count = EXCLUDED.slot_count;

    INSERT INTO server_image_slots (server_id, image_id, slot_count)
    VALUES (running_server_id, wine_image_id, 6)
    ON CONFLICT (server_id, image_id) DO UPDATE
    SET slot_count = EXCLUDED.slot_count;
  END IF;
END $$;

COMMIT;
