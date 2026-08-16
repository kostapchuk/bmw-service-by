<?php
/**
 * Скопировать в config.php рядом с action.php и вписать свои значения.
 * config.php в git не попадает — он в .gitignore.
 *
 * bot_token — выдаёт @BotFather при создании бота.
 * chat_id   — куда слать заявки: свой личный id (узнать у @userinfobot)
 *             или id группы, куда добавлен бот (у групп он с минусом).
 */

declare(strict_types=1);

return [
    'bot_token' => 'ВСТАВЬТЕ_ТОКЕН_БОТА',
    'chat_id'   => 'ВСТАВЬТЕ_CHAT_ID',
];
