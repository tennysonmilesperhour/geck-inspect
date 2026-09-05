-- Imported rows preserve their original integer primary keys. PostgreSQL does
-- not advance a sequence when an explicit id is inserted, so every sequence in
-- the consolidated schema must be aligned with its table before new ingest
-- jobs can safely allocate ids.
do $$
declare
  sequence_record record;
  maximum_value bigint;
begin
  for sequence_record in
    select
      columns.table_name,
      columns.column_name,
      pg_get_serial_sequence(
        format('%I.%I', columns.table_schema, columns.table_name),
        columns.column_name
      ) as sequence_name
    from information_schema.columns
    where columns.table_schema = 'geck_data'
      and (
        columns.column_default like 'nextval(%'
        or columns.is_identity = 'YES'
      )
  loop
    if sequence_record.sequence_name is null then
      continue;
    end if;

    execute format(
      'select max(%I)::bigint from %I.%I',
      sequence_record.column_name,
      'geck_data',
      sequence_record.table_name
    ) into maximum_value;

    if maximum_value is null then
      perform setval(sequence_record.sequence_name::regclass, 1, false);
    else
      perform setval(
        sequence_record.sequence_name::regclass,
        maximum_value,
        true
      );
    end if;
  end loop;
end
$$;
